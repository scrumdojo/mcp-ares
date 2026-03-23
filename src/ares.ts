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
