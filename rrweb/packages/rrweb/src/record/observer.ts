const observer = new (mutationObserverCtor as new (
  callback: MutationCallback
) => MutationObserver)(
  callbackWrapper(mutations => {
    // If this callback returns `false`, we do not want to process the mutations
    // This can be used to e.g. do a manual full snapshot when mutations become too large, or similar.
    // If it returns an array, we use that as the pre-processed mutations.
    if (options.onMutation) {
      const result = options.onMutation(mutations);
      if (result === false) {
        return;
      }
      // If onMutation returns an array, use it as the processed mutations
      if (Array.isArray(result)) {
        mutationBuffer.processMutations.bind(mutationBuffer)(result);
        return;
      }
    }
    mutationBuffer.processMutations.bind(mutationBuffer)(mutations);
  })
);
