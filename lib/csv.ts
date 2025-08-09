import Papa from 'papaparse';
import type { ItemMetaBox } from './types';

type Agency = 'adobe'|'shutterstock'|'vecteezy'|'freepik'|'dreamstime';

export function exportCSV(agency: Agency, rows: ItemMetaBox[]) {
  switch (agency) {
    case 'adobe': return adobeCSV(rows);
    case 'shutterstock': return shutterstockCSV(rows);
    case 'vecteezy': return vecteezyCSV(rows);
    case 'freepik': return freepikCSV(rows);
    case 'dreamstime': return dreamstimeCSV(rows);
  }
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
  const csv = exportCSV(agency, items);
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  download(`${agency}-metadata-${stamp}.csv`, csv);
}

// Adobe Stock: headers required: Filename, Keywords, Title; Category optional
function adobeCSV(items: ItemMetaBox[]) {
  const data = items.map(it => ({
    Filename: it.filename,
    Title: it.meta?.title || '',
    Keywords: it.meta?.keywords || '',
    Category: '' // optional numeric (1..)
  }));
  return Papa.unparse(data, { quotes: true });
}

// Shutterstock: commonly accepts Filename, Description (Title), Keywords. Keep both Title and Description.
function shutterstockCSV(items: ItemMetaBox[]) {
  const data = items.map(it => ({
    Filename: it.filename,
    Title: it.meta?.title || '',
    Description: it.meta?.description || '',
    Keywords: it.meta?.keywords || ''
  }));
  return Papa.unparse(data, { quotes: true });
}

// Vecteezy: Filename, Title, Description, Keywords (in this exact order)
function vecteezyCSV(items: ItemMetaBox[]) {
  const data = items.map(it => ({
    Filename: it.filename,
    Title: it.meta?.title || '',
    Description: it.meta?.description || '',
    Keywords: (it.meta?.keywords || '').replace(/,\s+/g, ',')
  }));
  return Papa.unparse(data, { quotes: true });
}

// Freepik: minimal three columns (filename, title, keywords)
function freepikCSV(items: ItemMetaBox[]) {
  const data = items.map(it => ({
    filename: it.filename,
    title: it.meta?.title || '',
    keywords: (it.meta?.keywords || '').replace(/,\s+/g, ',')
  }));
  return Papa.unparse(data, { quotes: true });
}

// Dreamstime: template is wide; provide a minimal starter with essential fields they map (you can enrich later)
function dreamstimeCSV(items: ItemMetaBox[]) {
  const data = items.map(it => ({
    filename: it.filename,
    description: it.meta?.description || '',
    keywords: (it.meta?.keywords || '').replace(/,\s+/g, ',')
  }));
  return Papa.unparse(data, { quotes: true });
}