import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {getExploreUrl} from 'sentry/views/explore/utils';

type ExploreParams = Parameters<typeof getExploreUrl>[0];

interface ToolbarProps {
  onOpenFullScreen: () => void;
  exploreParams?: Omit<ExploreParams, 'organization' | 'selection'>;
}

export function Toolbar({exploreParams, onOpenFullScreen}: ToolbarProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const exploreUrl =
    exploreParams && getExploreUrl({...exploreParams, organization, selection});

  return (
    <Widget.WidgetToolbar>
      {exploreUrl ? (
        <DropdownMenu
          size="xs"
          position="bottom-end"
          trigger={triggerProps => (
            <Button
              {...triggerProps}
              size="xs"
              borderless
              icon={<IconEllipsis />}
              aria-label={t('More actions')}
            />
          )}
          items={[
            {
              key: 'open-in-explore',
              label: t('Open in Explore'),
              to: exploreUrl,
            },
          ]}
        />
      ) : null}
      <Button
        size="xs"
        aria-label={t('Open Full-Screen View')}
        borderless
        icon={<IconExpand />}
        onClick={onOpenFullScreen}
      />
    </Widget.WidgetToolbar>
  );
}
