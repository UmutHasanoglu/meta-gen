import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock document.createElement and URL methods before importing
const mockClick = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');

Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn().mockReturnValue({
      click: mockClick,
      href: '',
      download: '',
    }),
  },
  writable: true,
});

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

Object.defineProperty(global, 'Blob', {
  value: class MockBlob {
    constructor(public parts: string[], public options: { type: string }) {}
  },
  writable: true,
});

// Import after mocks are set up
import { downloadAgencyCSV } from '../csv';
import type { ItemMetaBox } from '../types';

describe('downloadAgencyCSV', () => {
  const mockItems: ItemMetaBox[] = [
    {
      id: '1',
      filename: 'image1.jpg',
      fileType: 'photo',
      assetType: 'image',
      createdAt: Date.now(),
      meta: {
        title: 'Beautiful sunset',
        description: 'A stunning sunset over the ocean',
        keywords: 'sunset, ocean, sky',
        category: 'Nature',
        releases: 'None required',
      },
    },
    {
      id: '2',
      filename: 'image2.jpg',
      fileType: 'photo',
      assetType: 'image',
      createdAt: Date.now(),
      meta: {
        title: 'City skyline',
        description: 'Modern city at night',
        keywords: 'city, night, buildings',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create Adobe CSV with correct headers', () => {
    downloadAgencyCSV('adobe', mockItems);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('Filename,Title,Keywords,Category,Releases');
    expect(csvContent).toContain('"image1.jpg"');
    expect(csvContent).toContain('"Beautiful sunset"');
    expect(csvContent).toContain('"Nature"');
  });

  it('should create Shutterstock CSV with correct headers', () => {
    downloadAgencyCSV('shutterstock', mockItems);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('Filename,Description,Keywords');
    expect(csvContent).not.toContain('Category');
  });

  it('should create Vecteezy CSV with correct headers', () => {
    downloadAgencyCSV('vecteezy', mockItems);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('Filename,Title,Description,Keywords');
  });

  it('should create Freepik CSV with lowercase headers', () => {
    downloadAgencyCSV('freepik', mockItems);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('filename,title,keywords');
  });

  it('should create Dreamstime CSV with correct headers', () => {
    downloadAgencyCSV('dreamstime', mockItems);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('filename,title,description,keywords');
  });

  it('should escape double quotes in values', () => {
    const itemsWithQuotes: ItemMetaBox[] = [
      {
        id: '1',
        filename: 'test.jpg',
        fileType: 'photo',
        assetType: 'image',
        createdAt: Date.now(),
        meta: {
          title: 'A "quoted" title',
          description: 'Description with "quotes"',
          keywords: 'test',
        },
      },
    ];

    downloadAgencyCSV('adobe', itemsWithQuotes);

    const blobArg = mockCreateObjectURL.mock.calls[0][0] as { parts: string[] };
    const csvContent = blobArg.parts[0];

    expect(csvContent).toContain('""quoted""');
  });

  it('should trigger download', () => {
    downloadAgencyCSV('adobe', mockItems);

    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });
});
