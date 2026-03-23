#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lookupByIco, searchSubjects, lookupVr, lookupRzp, lookupCeu } from "./ares.js";

const server = new McpServer({
  name: "mcp-ares",
  version: "0.1.0",
});

server.tool(
  "ares_lookup_ico",
  "Look up a Czech company by IČO (identification number) in the ARES registry. Returns company name, address, legal form, VAT number, registration dates, and status.",
  {
    ico: z.string().describe("8-digit IČO (company identification number)"),
  },
  async ({ ico }) => {
    try {
      const subject = await lookupByIco(ico);

      const registrations = Object.entries(subject.seznamRegistraci)
        .filter(([, status]) => status === "AKTIVNI")
        .map(([key]) => key.replace("stavZdroje", ""))
        .join(", ");

      const lines = [
        `Company: ${subject.obchodniJmeno}`,
        `IČO: ${subject.ico}`,
        `Address: ${subject.sidlo.textovaAdresa}`,
        `Legal form: ${subject.pravniForma}`,
        subject.dic ? `DIČ (VAT): ${subject.dic}` : null,
        `Founded: ${subject.datumVzniku}`,
        subject.datumZaniku ? `Dissolved: ${subject.datumZaniku}` : null,
        `Last updated: ${subject.datumAktualizace}`,
        registrations ? `Active registrations: ${registrations}` : null,
        subject.czNace2008?.length
          ? `CZ-NACE codes: ${subject.czNace2008.join(", ")}`
          : null,
      ];

      return {
        content: [
          {
            type: "text" as const,
            text: lines.filter(Boolean).join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "ares_vr_detail",
  "Get commercial register (Veřejný rejstřík) details for a Czech company. Returns directors, shareholders, registered capital, business activities, and court file reference.",
  {
    ico: z.string().describe("8-digit IČO (company identification number)"),
  },
  async ({ ico }) => {
    try {
      const vr = await lookupVr(ico);
      const record = vr.zaznamy.find((r) => r.primarniZaznam) ?? vr.zaznamy[0];
      if (!record) throw new Error("No records found");

      const lines: string[] = [];

      const name = record.obchodniJmeno?.[0]?.hodnota;
      if (name) lines.push(`Company: ${name}`);
      lines.push(`IČO: ${ico}`);
      if (record.stavSubjektu) lines.push(`Status: ${record.stavSubjektu}`);
      if (record.datumZapisu) lines.push(`Registered: ${record.datumZapisu}`);

      const sz = record.spisovaZnacka?.[0];
      if (sz) lines.push(`Court file: ${sz.oddil} ${sz.vlozka}/${sz.soud}`);

      const capital = record.zakladniKapital?.[0];
      if (capital) {
        const unit = capital.vklad.typObnos === "KORUNY" ? "CZK" : capital.vklad.typObnos;
        lines.push(`Registered capital: ${capital.vklad.hodnota} ${unit}`);
      }

      for (const organ of record.statutarniOrgany ?? []) {
        lines.push(`\n--- ${organ.nazevOrganu} ---`);
        for (const clen of organ.clenoveOrganu ?? []) {
          if (clen.datumVymazu) continue; // skip removed members
          const person = clen.fyzickaOsoba
            ? `${clen.fyzickaOsoba.jmeno} ${clen.fyzickaOsoba.prijmeni}`
            : clen.pravnickaOsoba?.obchodniJmeno ?? "Unknown";
          const role = clen.clenstvi?.funkce?.nazev ?? clen.typAngazma;
          lines.push(`  ${person} — ${role} (since ${clen.datumZapisu})`);
        }
        if (organ.zpusobJednani?.[0]) {
          lines.push(`  Manner of acting: ${organ.zpusobJednani[0].hodnota}`);
        }
      }

      for (const group of record.spolecnici ?? []) {
        lines.push(`\n--- Shareholders ---`);
        for (const s of group.spolecnik ?? []) {
          if (s.osoba.datumVymazu) continue;
          const person = s.osoba.fyzickaOsoba
            ? `${s.osoba.fyzickaOsoba.jmeno} ${s.osoba.fyzickaOsoba.prijmeni}`
            : s.osoba.pravnickaOsoba?.obchodniJmeno ?? "Unknown";
          const share = s.podil?.[0]?.velikostPodilu;
          const shareStr = share ? ` (${share.hodnota}${share.typObnos === "PROCENTA" ? "%" : ""})` : "";
          lines.push(`  ${person}${shareStr}`);
        }
      }

      const activities = [
        ...(record.cinnosti?.predmetPodnikani ?? []),
        ...(record.cinnosti?.predmetCinnosti ?? []),
      ];
      if (activities.length > 0) {
        lines.push(`\n--- Business activities ---`);
        for (const a of activities) lines.push(`  - ${a.hodnota}`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "ares_rzp_detail",
  "Get trade license (Živnostenský rejstřík) details for a Czech company. Returns trade licenses, business premises, and responsible persons.",
  {
    ico: z.string().describe("8-digit IČO (company identification number)"),
  },
  async ({ ico }) => {
    try {
      const rzp = await lookupRzp(ico);
      const record = rzp.zaznamy.find((r) => r.primarniZaznam) ?? rzp.zaznamy[0];
      if (!record) throw new Error("No records found");

      const lines: string[] = [];
      lines.push(`Company: ${record.obchodniJmeno}`);
      lines.push(`IČO: ${record.ico}`);

      if (record.zivnostiStav) {
        const s = record.zivnostiStav;
        lines.push(`\nTrade licenses: ${s.pocetCelkem} total (${s.pocetAktivnich} active, ${s.pocetZaniklych} expired, ${s.pocetPozastavenych} suspended, ${s.pocetPrerusenych} interrupted)`);
      }

      for (const z of record.zivnosti ?? []) {
        const status = z.datumZaniku ? " [EXPIRED]" : "";
        const type = z.druhZivnosti === "L" ? "Free" : z.druhZivnosti === "R" ? "Regulated" : z.druhZivnosti === "V" ? "Licensed" : z.druhZivnosti;
        lines.push(`\n--- Trade license (${type})${status} ---`);
        lines.push(`  ${z.predmetPodnikani}`);
        lines.push(`  Since: ${z.datumVzniku}`);
        if (z.oboryCinnosti?.length) {
          lines.push(`  Fields of activity:`);
          for (const o of z.oboryCinnosti) lines.push(`    - ${o.oborNazev}`);
        }
        if (z.provozovny?.length) {
          lines.push(`  Business premises:`);
          for (const p of z.provozovny) lines.push(`    - ${p.sidloProvozovny.textovaAdresa}`);
        }
      }

      if (record.angazovaneOsoby?.length) {
        lines.push(`\n--- Responsible persons ---`);
        for (const o of record.angazovaneOsoby) {
          lines.push(`  ${o.jmeno} ${o.prijmeni} (${o.typAngazma})`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "ares_insolvency_check",
  "Check if a Czech company has any insolvency (bankruptcy) records in the CEU registry.",
  {
    ico: z.string().describe("8-digit IČO (company identification number)"),
  },
  async ({ ico }) => {
    try {
      const result = await lookupCeu(ico);
      if (!result.found) {
        return {
          content: [{ type: "text" as const, text: `IČO ${ico}: No insolvency records found. The company has no entries in the Central Insolvency Register (CEU).` }],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: `⚠ IČO ${ico}: INSOLVENCY RECORD FOUND.\n\nRaw data:\n${JSON.stringify(result.raw, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "ares_bulk_lookup",
  "Look up multiple Czech companies by IČO at once. Returns a summary table with name, address, status, and VAT number for each.",
  {
    ico_list: z.array(z.string()).describe("Array of IČO numbers to look up (max 20)"),
  },
  async ({ ico_list }) => {
    if (ico_list.length > 20) {
      return {
        content: [{ type: "text" as const, text: "Error: Maximum 20 IČOs per request." }],
        isError: true,
      };
    }

    const results = await Promise.allSettled(
      ico_list.map((ico) => lookupByIco(ico))
    );

    const lines: string[] = [];
    for (let i = 0; i < ico_list.length; i++) {
      const ico = ico_list[i];
      const result = results[i];
      if (result.status === "fulfilled") {
        const s = result.value;
        const status = s.datumZaniku ? "DISSOLVED" : "ACTIVE";
        lines.push(
          `${s.ico} | ${status} | ${s.obchodniJmeno} | ${s.sidlo.textovaAdresa} | ${s.dic ?? "N/A"}`
        );
      } else {
        lines.push(`${ico} | ERROR | ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }

    const header = "IČO | Status | Name | Address | DIČ\n" + "---|---|---|---|---\n";
    return {
      content: [{ type: "text" as const, text: header + lines.join("\n") }],
    };
  }
);

server.tool(
  "ares_search",
  "Search for Czech companies in the ARES registry by name, address, legal form, or NACE code. Returns a list of matching companies.",
  {
    name: z.string().optional().describe("Company name (partial match)"),
    ico: z.array(z.string()).optional().describe("Array of IČO numbers to search"),
    legal_form: z.array(z.string()).optional().describe("Legal form codes (e.g. '112' for s.r.o., '121' for a.s.)"),
    nace: z.array(z.string()).optional().describe("CZ-NACE activity codes"),
    start: z.number().optional().describe("Pagination offset (default 0)"),
    limit: z.number().optional().describe("Number of results (default 10, max 100)"),
  },
  async ({ name, ico, legal_form, nace, start, limit }) => {
    try {
      const result = await searchSubjects({
        obchodniJmeno: name,
        ico,
        pravniForma: legal_form,
        czNace: nace,
        start: start ?? 0,
        pocet: Math.min(limit ?? 10, 100),
      });

      if (result.pocetCelkem === 0) {
        return {
          content: [{ type: "text" as const, text: "No companies found matching the search criteria." }],
        };
      }

      const header = `Found ${result.pocetCelkem} companies (showing ${result.ekonomickeSubjekty.length}):\n`;
      const entries = result.ekonomickeSubjekty.map((s) =>
        `- ${s.obchodniJmeno} (IČO: ${s.ico}) — ${s.sidlo.textovaAdresa}`
      );

      return {
        content: [{ type: "text" as const, text: header + entries.join("\n") }],
      };
    } catch (error) {
      return {
        content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
