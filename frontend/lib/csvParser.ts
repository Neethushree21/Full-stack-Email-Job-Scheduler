import Papa from "papaparse";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedLeads {
  emails: string[];
  invalidRows: number;
}

/**
 * Accepts a CSV or plain-text file of leads. Looks for a column literally
 * named "email" (case-insensitive); if the file has no header row at all,
 * falls back to scanning every cell for anything that looks like an email
 * address. De-duplicates the final list.
 */
export function parseLeadsFile(file: File): Promise<ParsedLeads> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string> | string[]>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const emailKey = results.meta.fields?.find((f) => f.trim().toLowerCase() === "email");

        const found = new Set<string>();
        let invalidRows = 0;

        if (emailKey) {
          for (const row of rows) {
            const value = (row[emailKey] || "").trim();
            if (EMAIL_REGEX.test(value)) found.add(value.toLowerCase());
            else if (value) invalidRows++;
          }
        } else {
          // No recognizable header — treat every cell in every row as a
          // candidate and keep anything that matches an email pattern.
          for (const row of rows) {
            for (const value of Object.values(row)) {
              const trimmed = (value || "").trim();
              if (EMAIL_REGEX.test(trimmed)) found.add(trimmed.toLowerCase());
            }
          }
        }

        resolve({ emails: Array.from(found), invalidRows });
      },
      error: (err) => reject(err),
    });
  });
}
