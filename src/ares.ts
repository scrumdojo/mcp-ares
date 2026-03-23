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

export interface VrRecord {
  rejstrik: string;
  spisovaZnacka?: Array<{
    soud: string;
    oddil: string;
    vlozka: number;
    datumZapisu: string;
  }>;
  obchodniJmeno?: Array<{ hodnota: string; datumZapisu: string }>;
  zakladniKapital?: Array<{
    vklad: { typObnos: string; hodnota: string };
    datumZapisu: string;
  }>;
  statutarniOrgany?: Array<{
    nazevOrganu: string;
    clenoveOrganu?: Array<{
      typAngazma: string;
      clenstvi?: { funkce?: { nazev: string } };
      fyzickaOsoba?: {
        jmeno: string;
        prijmeni: string;
        datumNarozeni?: string;
        adresa?: { textovaAdresa: string };
      };
      pravnickaOsoba?: {
        obchodniJmeno: string;
        ico?: string;
      };
      datumZapisu: string;
      datumVymazu?: string;
    }>;
    zpusobJednani?: Array<{ hodnota: string }>;
  }>;
  spolecnici?: Array<{
    spolecnik?: Array<{
      podil?: Array<{
        vklad: { hodnota: string; typObnos: string };
        velikostPodilu?: { hodnota: string; typObnos: string };
        splaceni?: { hodnota: string; typObnos: string };
      }>;
      osoba: {
        fyzickaOsoba?: { jmeno: string; prijmeni: string };
        pravnickaOsoba?: { obchodniJmeno: string; ico?: string };
        datumZapisu: string;
        datumVymazu?: string;
      };
    }>;
  }>;
  cinnosti?: {
    predmetPodnikani?: Array<{ hodnota: string }>;
    predmetCinnosti?: Array<{ hodnota: string }>;
  };
  stavSubjektu?: string;
  datumZapisu?: string;
  primarniZaznam?: boolean;
}

export interface VrResponse {
  icoId: string;
  zaznamy: VrRecord[];
}

export async function lookupVr(ico: string): Promise<VrResponse> {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty-vr/${encodeURIComponent(ico)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No commercial register record for IČO ${ico}`);
    }
    throw new Error(`ARES API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as VrResponse;
}

export interface RzpRecord {
  ico: string;
  obchodniJmeno: string;
  zivnosti?: Array<{
    predmetPodnikani: string;
    druhZivnosti: string;
    datumVzniku: string;
    datumZaniku?: string;
    oboryCinnosti?: Array<{ oborNazev: string }>;
    provozovny?: Array<{
      sidloProvozovny: { textovaAdresa: string };
    }>;
  }>;
  zivnostiStav?: {
    pocetAktivnich: number;
    pocetZaniklych: number;
    pocetPozastavenych: number;
    pocetPrerusenych: number;
    pocetCelkem: number;
  };
  angazovaneOsoby?: Array<{
    jmeno: string;
    prijmeni: string;
    typAngazma: string;
  }>;
  primarniZaznam?: boolean;
}

export interface RzpResponse {
  icoId: string;
  zaznamy: RzpRecord[];
}

export async function lookupRzp(ico: string): Promise<RzpResponse> {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty-rzp/${encodeURIComponent(ico)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`No trade register record for IČO ${ico}`);
    }
    throw new Error(`ARES API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as RzpResponse;
}

export async function lookupCeu(
  ico: string
): Promise<{ found: boolean; raw?: unknown }> {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty-ceu/${encodeURIComponent(ico)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { found: false };
    }
    throw new Error(
      `ARES API error: ${response.status} ${response.statusText}`
    );
  }

  return { found: true, raw: await response.json() };
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
