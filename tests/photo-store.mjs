export class PhotoStore {
  data = new Map();
  sequence = 0;
  async getWithMetadata(key, options) {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (options.type === "stream") return { ...entry, data: new Blob([entry.data]).stream() };
    return structuredClone(entry);
  }
  async set(key, data, options = {}) {
    const etag = String(++this.sequence);
    this.data.set(key, { data: structuredClone(data), metadata: options.metadata || {}, etag });
    return { modified: true, etag };
  }
  async setJSON(key, data, options = {}) {
    const existing = this.data.get(key);
    if ((options.onlyIfNew && existing) || (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch)) return { modified: false };
    return this.set(key, data);
  }
  async delete(key) { this.data.delete(key); }
}