import {Button} from '@sentry/scraps/button';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  MOBILE_BUILDS_ALLOWED_KEYS,
  MOBILE_BUILDS_DISTRIBUTION_ALLOWED_KEYS,
  SNAPSHOT_ALLOWED_KEYS,
} from 'sentry/components/preprod/constants';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';

const displaySelectOptions: Array<SelectOption<PreprodBuildsDisplay>> = [
  {value: PreprodBuildsDisplay.SIZE, label: t('Size')},
  {value: PreprodBuildsDisplay.DISTRIBUTION, label: t('Distribution')},
];

const DISTRIBUTION_FREEFORM_KEYS = ['install_groups'];

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
   * Hide the display mode toggle
   */
  hideDisplayToggle?: boolean;
  /**
   * Called on every keystroke (for controlled input with debounce)
   */
  onChange?: (query: string, state: {queryIsValid: boolean}) => void;
  /**
   * When provided, renders a "Download CSV" button in the controls.
   */
  onExportCsv?: () => void;
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
  hideDisplayToggle,
  onChange,
  onSearch,
  onDisplayChange,
  onExportCsv,
}: PreprodBuildsSearchControlsProps) {
  const displayAllowedKeys =
    display === PreprodBuildsDisplay.SNAPSHOT
      ? SNAPSHOT_ALLOWED_KEYS
      : display === PreprodBuildsDisplay.DISTRIBUTION
        ? MOBILE_BUILDS_DISTRIBUTION_ALLOWED_KEYS
        : MOBILE_BUILDS_ALLOWED_KEYS;
  const displayFreeformKeys =
    display === PreprodBuildsDisplay.DISTRIBUTION
      ? DISTRIBUTION_FREEFORM_KEYS
      : undefined;

  return (
    <Flex
      align={{zero: 'stretch', md: 'center'}}
      direction={{zero: 'column', md: 'row'}}
      gap="md"
      wrap="wrap"
    >
      <Container flex="1" minWidth="0" width="100%">
        <PreprodSearchBar
          initialQuery={initialQuery}
          allowedKeys={displayAllowedKeys}
          freeformKeys={displayFreeformKeys}
          onChange={onChange}
          onSearch={onSearch}
          projects={projects}
        />
      </Container>
      {onExportCsv && (
        <Container width={{zero: '100%', md: 'max-content'}}>
          {containerProps => (
            <Button {...containerProps} icon={<IconDownload />} onClick={onExportCsv}>
              {t('Download CSV')}
            </Button>
          )}
        </Container>
      )}
      {!hideDisplayToggle && (
        <Container
          maxWidth={{zero: 'none', md: '200px'}}
          width={{zero: '100%', md: 'max-content'}}
        >
          {containerProps => (
            <CompactSelect
              {...containerProps}
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
          )}
        </Container>
      )}
    </Flex>
  );
}
