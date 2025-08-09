import type { ItemMetaBox } from './types';

export type Agency = 'adobe'|'shutterstock'|'vecteezy'|'freepik'|'dreamstime';

function csvEscape(val: string): string {
  const s = (val ?? '').replace(/"/g, '""');
  return `"${s}"`;
}
function toCSV(headers: string[], rows: Record<string, string>[]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const lines = rows.map(r => headers.map(h => csvEscape(r[h] ?? '')).join(','));
  return [headerLine, ...lines].join('\r\n');
}

function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadAgencyCSV(agency: Agency, items: ItemMetaBox[]) {
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

  let headers: string[]; 
  let rows: Record<string,string>[];

  switch (agency) {
    case 'adobe':
      headers = ['Filename','Title','Keywords','Category'];
      rows = items.map(it => ({
        Filename: it.filename,
        Title: it.meta?.title ?? '',
        Keywords: it.meta?.keywords ?? '',
        Category: '' // optional numeric
      }));
      break;

    case 'shutterstock':
      headers = ['Filename','Title','Description','Keywords'];
      rows = items.map(it => ({
        Filename: it.filename,
        Title: it.meta?.title ?? '',
        Description: it.meta?.description ?? '',
        Keywords: it.meta?.keywords ?? ''
      }));
      break;

    case 'vecteezy':
      headers = ['Filename','Title','Description','Keywords'];
      rows = items.map(it => ({
        Filename: it.filename,
        Title: it.meta?.title ?? '',
        Description: it.meta?.description ?? '',
        Keywords: (it.meta?.keywords ?? '').replace(/,\s+/g, ',')
      }));
      break;

    case 'freepik':
      headers = ['filename','title','keywords'];
      rows = items.map(it => ({
        filename: it.filename,
        title: it.meta?.title ?? '',
        keywords: (it.meta?.keywords ?? '').replace(/,\s+/g, ',')
      }));
      break;

    case 'dreamstime':
      headers = ['filename','description','keywords'];
      rows = items.map(it => ({
        filename: it.filename,
        description: it.meta?.description ?? '',
        keywords: (it.meta?.keywords ?? '').replace(/,\s+/g, ',')
      }));
      break;
  }

  const csv = toCSV(headers, rows);
  download(`${agency}-metadata-${stamp}.csv`, csv);
}
