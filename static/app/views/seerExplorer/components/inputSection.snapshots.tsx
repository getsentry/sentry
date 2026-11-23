import {createRef, Fragment} from 'react';
import {IconSlashForward} from '@sentry/icons/slashForward';
import {IconSliders} from '@sentry/icons/sliders';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {InputSection} from './inputSection';
import {SeerSelectionTagButton} from './seerSelectionToggle';

function ComposerWithSelection({isIncluded}: {isIncluded: boolean}) {
  return (
    <QueryClientProvider client={new QueryClient()}>
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
            <SeerSelectionTagButton
              label="2 issues"
              isIncluded={isIncluded}
              onToggle={() => {}}
            />
          </Fragment>
        }
      />
    </QueryClientProvider>
  );
}

describe('Seer composer toolbar', () => {
  it.snapshot.each([320, 480])(
    'page context at %s px',
    () => <ComposerWithSelection isIncluded />,
    width => ({viewport: width})
  );

  it.snapshot('page context turned off', () => (
    <ComposerWithSelection isIncluded={false} />
  ));
});
