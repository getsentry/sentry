import {useState} from 'react';

import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import ReplaySelectorsListHovercard from 'sentry/components/replays/flows/actions/replaySelectorsListHovercard';
import {t} from 'sentry/locale';
import type {UIClickAction} from 'sentry/utils/replays/assertions/types';

export default function ClickInput({
  disabled,
  initialAction,
  onChange,
  projectId,
}: {
  disabled: boolean;
  initialAction: null | UIClickAction;
  onChange: (action: UIClickAction) => void;
  projectId: string;
}) {
  const [value, setValue] = useState<string>(
    initialAction?.matcher.dom_element.fullSelector ?? ''
  );
  return (
    <Flex gap="xs" align="center" wrap="nowrap">
      <Text>{t('that matches')}</Text>
      <ReplaySelectorsListHovercard
        onChange={action => {
          onChange(action);
          setValue(action.matcher.dom_element.fullSelector);
        }}
        projectId={projectId}
      >
        <Input
          value={value}
          disabled={disabled}
          size="xs"
          placeholder={t('Search for an element')}
        />
      </ReplaySelectorsListHovercard>
    </Flex>
  );
}
