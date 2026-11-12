import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {ReplaysFilters} from './filters';
import {ReplayIndexTimestampPrefPicker} from './replayIndexTimestampPrefPicker';
import {ReplayWidgetsToggleButton} from './replayWidgetsToggleButton';
import {SaveReplayQueryButton} from './saveReplayQueryButton';
import {ReplaysSearch} from './search';

interface Props {
  onToggleWidgets: () => void;
  showDeadRageClickCards: boolean;
  widgetIsOpen: boolean;
}

export function ReplayListControls({
  onToggleWidgets,
  showDeadRageClickCards,
  widgetIsOpen,
}: Props) {
  return (
    <Grid
      areas={{
        zero: `
          "filters"
          "search"
          "actions"
        `,
        xl: `
          "filters actions"
          "search search"
        `,
        '4xl': '"filters search actions"',
      }}
      columns={{
        zero: '100%',
        xl: '1fr auto',
        '4xl': 'auto 1fr auto',
      }}
      gap="md"
      width="100%"
    >
      <Container area="filters">
        <ReplaysFilters />
      </Container>
      <Container area="search">
        <ReplaysSearch />
      </Container>
      <Flex area="actions" align="start" gap="md" justifySelf="end" wrap="wrap">
        <ReplayIndexTimestampPrefPicker />
        {showDeadRageClickCards ? (
          <ReplayWidgetsToggleButton
            onClick={onToggleWidgets}
            widgetIsOpen={widgetIsOpen}
          />
        ) : null}
        <SaveReplayQueryButton />
      </Flex>
    </Grid>
  );
}
