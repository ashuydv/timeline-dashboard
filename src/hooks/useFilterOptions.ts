import { useEffect, useState } from 'react';
import { getAssetTree, getShifts } from '../api/endpoints';
import { flattenAssetTree, type FlatAssetOption } from '../utils/assetTree';
import { buildShiftOptions, type ShiftOption } from '../utils/shiftOptions';

interface FilterOptionsState {
  assets: FlatAssetOption[];
  shiftOptions: ShiftOption[];
  loading: boolean;
  error: string | null;
}

export function useFilterOptions(): FilterOptionsState {
  const [state, setState] = useState<FilterOptionsState>({
    assets: [],
    shiftOptions: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([getAssetTree(), getShifts()])
      .then(([tree, shifts]) => {
        if (cancelled) return;
        setState({
          assets: flattenAssetTree(tree),
          shiftOptions: buildShiftOptions(shifts),
          loading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : 'Failed to load filters' }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
