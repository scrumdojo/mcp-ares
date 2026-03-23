const ARES_BASE_URL = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

export interface AresSubject {
  ico: string;
  obchodniJmeno: string;
  sidlo: {
    textovaAdresa: string;
    psc: number;
    nazevObce: string;
    nazevUlice?: string;
    cisloDomovni?: number;
    cisloOrientacni?: number;
    nazevKraje?: string;
  };
  pravniForma: string;
  datumVzniku: string;
  datumZaniku?: string;
  datumAktualizace: string;
  dic?: string;
  icoId: string;
  seznamRegistraci: Record<string, string>;
  czNace2008?: string[];
}

export interface AresSearchResult {
  pocetCelkem: number;
  ekonomickeSubjekty: AresSubject[];
}

export interface AresSearchFilter {
  obchodniJmeno?: string;
  ico?: string[];
  sidlo?: {
    kodObce?: number;
    textovaAdresa?: string;
  };
  pravniForma?: string[];
  czNace?: string[];
  start?: number;
  pocet?: number;
}

export async function searchSubjects(
  filter: AresSearchFilter
): Promise<AresSearchResult> {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty/vyhledat`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...filter,
      start: filter.start ?? 0,
      pocet: filter.pocet ?? 10,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `ARES API error: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as AresSearchResult;
}

export async function lookupByIco(ico: string): Promise<AresSubject> {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty/${encodeURIComponent(ico)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No entity found for IČO ${ico}`);
    }
    throw new Error(
      `ARES API error: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as AresSubject;
}
