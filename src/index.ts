#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lookupByIco } from "./ares.js";

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

const transport = new StdioServerTransport();
await server.connect(transport);
