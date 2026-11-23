import {createRef, Fragment} from 'react';
import {IconSlashForward} from '@sentry/icons/slashForward';
import {IconSliders} from '@sentry/icons/sliders';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {
  type SeerSelection,
  SeerSelectionProvider,
  usePublishSeerSelection,
} from 'sentry/views/seerExplorer/contexts/seerSelection';

import {InputSection} from './inputSection';
import {SeerSelectionToggle} from './seerSelectionToggle';

const SELECTION: SeerSelection = {
  itemType: 'issue',
  count: 2,
  items: [{shortId: 'PROJ-1'}, {shortId: 'PROJ-2'}],
};

function SelectedIssues() {
  usePublishSeerSelection(SELECTION);
  return null;
}

describe('Seer composer toolbar', () => {
  it.snapshot.each([320, 480])(
    'page context at %s px',
    () => (
      <QueryClientProvider client={new QueryClient()}>
        <SeerSelectionProvider>
          <SelectedIssues />
          <InputSection
            composerRef={createRef()}
            enabled
            canSendMessage={false}
            inputValue={{text: '', mentions: []}}
            onInputChange={() => {}}
            onInputClick={() => {}}
            onInterrupt={() => {}}
            onKeyDown={() => {}}
            onSend={() => {}}
            repoPRStates={{}}
            leadingToolbarItems={
              <Fragment>
                <Flex align="center">
                  <Button
                    icon={<IconSlashForward />}
                    aria-label="Commands"
                    size="zero"
                    variant="transparent"
                  />
                  <Button
                    icon={<IconSliders />}
                    aria-label="Seer settings"
                    size="zero"
                    variant="transparent"
                  />
                </Flex>
                <SeerSelectionToggle />
              </Fragment>
            }
          />
        </SeerSelectionProvider>
      </QueryClientProvider>
    ),
    width => ({viewport: width})
  );
});
