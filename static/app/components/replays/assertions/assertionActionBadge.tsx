import {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import type {AssertionAction} from 'sentry/utils/replays/assertions/types';

interface Props {
  action: AssertionAction;
}

export default function AssertionActionBadge({action}: Props) {
  switch (action.type) {
    case 'breadcrumb': {
      switch (action.matcher.category) {
        case 'ui.click': {
          return (
            <Flex gap="xs" border="primary" padding="md" radius="md">
              <Text bold>{action.matcher.category}</Text>
              {JSON.stringify(action.matcher.selector)}
            </Flex>
          );
        }
        case 'navigation': {
          return (
            <Fragment>
              <Text bold>{action.matcher.category}</Text>
            </Fragment>
          );
        }
        default:
          // eslint-disable-next-line no-console
          console.error('Unknown category:', action.matcher);
          return null;
      }
    }
    case 'span': {
      switch (action.matcher.op) {
        case 'navigation.navigate': {
          return <Text bold>{action.matcher.op}</Text>;
        }
        default:
          // eslint-disable-next-line no-console
          console.error('Unknown op:', action.matcher);
          return null;
      }
    }
    default:
      return null;
  }
}
