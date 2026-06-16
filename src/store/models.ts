import { create } from 'zustand';
import { fetchModels, enrich, MODELS, type EnrichedModel, type ModelDef } from '../api/models';

interface ModelsState {
  models: EnrichedModel[];
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
  source: 'static' | 'gateway';
  load: () => Promise<void>;
  /** Returns the dynamic catalog if loaded, otherwise the static fallback (cast to EnrichedModel shape). */
  catalog: () => (EnrichedModel | ModelDef)[];
}

export const useModels = create<ModelsState>((set, get) => ({
  models: [],
  loading: false,
  error: null,
  loadedAt: null,
  source: 'static',
  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const raw = await fetchModels();
      if (raw.length === 0) {
        // Gateway returned nothing — keep static, no error UI
        set({ loading: false, source: 'static', loadedAt: Date.now() });
        return;
      }
      const enriched = raw
        .map(enrich)
        .filter((m) => m.available !== false);
      set({
        models: enriched,
        loading: false,
        source: 'gateway',
        loadedAt: Date.now(),
      });
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to load models', loading: false, source: 'static' });
    }
  },
  catalog: () => {
    const { models } = get();
    return models.length > 0 ? models : MODELS;
  },
}));
