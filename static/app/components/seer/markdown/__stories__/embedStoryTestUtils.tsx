import {screen} from 'sentry-test/reactTestingLibrary';

/**
 * One element per example, for specs that stub `SeerMarkdown` to echo its raw
 * prop. A variant renders its embed once per level it declares, so the block
 * demo -- whose raw is the bare tag -- is the one carrying the data the story
 * chose.
 */
export async function findExampleTags() {
  const demos = await screen.findAllByLabelText('Rendered markdown');
  return demos.filter(demo => demo.textContent?.startsWith('{%'));
}
