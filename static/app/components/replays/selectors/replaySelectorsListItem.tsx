import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {formatSelectorAsCode} from 'sentry/components/replays/flows/selectorCodeFormatter';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

interface Props {
  item: DeadRageSelectorItem;
  onSelect: (item: DeadRageSelectorItem) => void;
}

export default function ReplaySelectorsListItem({onSelect, item}: Props) {
  return (
    <Flex padding="sm xs" position="relative">
      <a
        href="#"
        onClick={e => {
          e.preventDefault();
          onSelect(item);
        }}
      >
        <InteractionStateLayer />

        <Text>{formatSelectorAsCode(item.dom_element)}</Text>
      </a>
    </Flex>
  );
}
