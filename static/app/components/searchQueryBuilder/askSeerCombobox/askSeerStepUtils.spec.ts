import {formatStep} from './askSeerStepUtils';

describe('formatStep', () => {
  it.each([
    ['get_field_values', 'Investigating your tags...', 'Investigated tags'],
    ['get_metric_candidates', 'Finding matching metrics...', 'Found matching metrics'],
    ['execute_query', 'Fine-tuning your query...', 'Fine-tuned query'],
    ['finalize_queries', 'Double-checking everything...', 'All done!'],
    ['mark_unsupported', 'Working through this...', 'This query is not supported'],
  ])('uses explicit labels for %s', (key, loadingLabel, completedLabel) => {
    expect(formatStep({key}, true, 0)).toBe(loadingLabel);
    expect(formatStep({key}, false, 0)).toBe(completedLabel);
  });

  it.each([
    ['be_ready', 'Be ready'],
    ['die_safely', 'Die safely'],
    ['fix_query', 'Fix query'],
    ['open_trace', 'Open trace'],
    ['play_back', 'Play back'],
  ])('uses grammar-neutral fallback labels for unknown step %s', (key, label) => {
    expect(formatStep({key}, true, 0)).toBe(`Running step: ${label}...`);
    expect(formatStep({key}, false, 0)).toBe(`Finished step: ${label}`);
  });
});
