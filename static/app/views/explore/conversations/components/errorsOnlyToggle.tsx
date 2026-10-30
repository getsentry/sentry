import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useErrorsOnlyFilter} from 'sentry/views/explore/conversations/hooks/useErrorsOnlyFilter';
import {useTableCursor} from 'sentry/views/insights/pages/agents/hooks/useTableCursor';

export function ErrorsOnlyToggle() {
  const {errorsOnly, setErrorsOnly} = useErrorsOnlyFilter();
  const {unsetCursor} = useTableCursor();

  return (
    <Flex as="label" align="center" gap="sm" margin="0" flexShrink={0}>
      <Switch
        checked={errorsOnly}
        onChange={event => {
          setErrorsOnly(event.target.checked);
          unsetCursor();
        }}
      />
      <Text wrap="nowrap">{t('Errors only')}</Text>
    </Flex>
  );
}
