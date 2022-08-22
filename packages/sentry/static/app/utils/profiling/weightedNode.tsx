/**
 * This is a utility class for profiling (inspired from Speedscope) - we extend it in order to be able to construct
 * a stack of nodes (or call trees) and append weights to them.
 */
export class WeightedNode {
  // Total weight is the weight of the node and all its children.
  totalWeight: number = 0;
  // Self weight is the weight of the node itself.
  selfWeight: number = 0;

  addToTotalWeight(delta: number): number {
    this.totalWeight += delta;
    return this.totalWeight;
  }
  addToSelfWeight(delta: number): number {
    this.selfWeight += delta;
    return this.selfWeight;
  }
}
