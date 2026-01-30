import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

const displaySelectOptions: Array<SelectOption<PreprodBuildsDisplay>> = [
  {value: PreprodBuildsDisplay.SIZE, label: t('Size')},
  {value: PreprodBuildsDisplay.DISTRIBUTION, label: t('Distribution')},
];

interface PreprodBuildsSearchControlsProps {
  /**
   * Current display mode value from URL query
   */
  display: PreprodBuildsDisplay;
  /**
   * Initial search query value
   */
  initialQuery: string;
  /**
   * Called when display mode changes
   */
  onDisplayChange: (display: PreprodBuildsDisplay) => void;
  /**
   * Project IDs to filter search attributes
   */
  projects: number[];
  /**
   * Called on every keystroke (for controlled input with debounce)
   */
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  /**
   * Called when search is submitted (e.g., on Enter)
   */
  onSearch?: (query: string) => void;
}

/**
 * Reusable search controls for preprod builds pages.
 * Combines search bar with optional display mode toggle.
 */
export function PreprodBuildsSearchControls({
  initialQuery,
  display,
  projects,
  onChange,
  onSearch,
  onDisplayChange,
}: PreprodBuildsSearchControlsProps) {
  const organization = useOrganization();
  const hasDistributionFeature = organization.features.includes(
    'preprod-build-distribution'
  );

  return (
    <Flex
      align={{xs: 'stretch', sm: 'center'}}
      direction={{xs: 'column', sm: 'row'}}
      gap="md"
      wrap="wrap"
    >
      <Container flex="1">
        <PreprodSearchBar
          initialQuery={initialQuery}
          onChange={onChange}
          onSearch={onSearch}
          projects={projects}
        />
      </Container>
      {hasDistributionFeature && (
        <Container maxWidth="200px">
          <CompactSelect
            options={displaySelectOptions}
            value={display}
            onChange={option => onDisplayChange(option.value)}
            trigger={triggerProps => (
              <OverlayTrigger.Button
                {...triggerProps}
                prefix={t('Display')}
                style={{width: '100%', zIndex: 1}}
              />
            )}
          />
        </Container>
      )}
    </Flex>
  );
}
