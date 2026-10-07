/** Jeden organický (neplatený) výsledok z 1. strany vyhľadávania. */
export interface OrganicResult {
  /** Poradie na stránke, začína od 1. */
  position: number;
  title: string;
  url: string;
  snippet: string;
}

/** Kompletná odpoveď vyhľadávania, ktorá sa exportuje do súboru. */
export interface SearchResult {
  query: string;
  /** ISO 8601 čas získania dát. */
  fetchedAt: string;
  results: OrganicResult[];
}

/** Zdroj výsledkov vyhľadávania (napr. SERP API); umožňuje zámenu a mockovanie v testoch. */
export interface SerpProvider {
  search(query: string): Promise<OrganicResult[]>;
}

/** Neplatný vstup od používateľa → HTTP 400. */
export class ValidationError extends Error {
  override readonly name = 'ValidationError';
}

/** Zlyhanie externého zdroja dát → HTTP 502. */
export class ProviderError extends Error {
  override readonly name = 'ProviderError';
}
