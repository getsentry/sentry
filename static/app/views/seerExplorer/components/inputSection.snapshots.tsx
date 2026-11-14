import {createRef, Fragment} from 'react';
import {IconAdd} from '@sentry/icons/add';
import {IconSliders} from '@sentry/icons/sliders';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';

import {InputSection} from './inputSection';

describe('Seer composer toolbar', () => {
  it.snapshot.each([320, 480])(
    'page context at %s px',
    () => (
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
              <Button
                icon={<IconAdd />}
                aria-label="Add to conversation"
                size="zero"
                variant="transparent"
              />
              <Button
                icon={<IconSliders />}
                aria-label="Seer settings"
                size="zero"
                variant="transparent"
              />
              <Tag variant="info">2 Issues Selected</Tag>
            </Fragment>
          }
        />
      </QueryClientProvider>
    ),
    width => ({viewport: width})
  );
});
