#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lookupByIco, searchSubjects } from "./ares.js";

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
