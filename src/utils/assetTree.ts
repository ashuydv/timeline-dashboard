import type { AssetNode } from '../types/api';

export interface FlatAssetOption {
  id: string;
  assetlevel_id: number;
  label: string; // indented display name showing hierarchy depth
  depth: number;
}

/** Flatten the asset tree into a depth-indented list so the user can pick any node. */
export function flattenAssetTree(nodes: AssetNode[], depth = 0): FlatAssetOption[] {
  const result: FlatAssetOption[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      assetlevel_id: node.assetlevel_id,
      label: `${' '.repeat(depth)}${node.name}${node.codename ? ` (${node.codename})` : ''}`,
      depth,
    });
    if (node.children?.length) {
      result.push(...flattenAssetTree(node.children, depth + 1));
    }
  }
  return result;
}
