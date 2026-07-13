import {useCallback, useMemo} from 'react';

import {
  CompactSelect,
  MenuComponents,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {findSpanAttributeValue} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import {TraceShortcutsModal} from 'sentry/views/performance/newTraceDetails/traceShortcutsModal';
import {TRACE_WATERFALL_TIME_COMPRESSION_FEATURE} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';

interface TracePreferencesDropdownProps {
  autogroup: boolean;
  compressedTimeline: boolean;
  missingInstrumentation: boolean;
  onAutogroupChange: () => void;
  onCompressedTimelineChange: () => void;
  onMissingInstrumentationChange: () => void;
  rootEventResults: TraceRootEventQueryResults;
}

export function TracePreferencesDropdown(props: TracePreferencesDropdownProps) {
  const {openModal} = useModal();

  const organization = useOrganization();
  const {projects} = useProjects();
  const hasCompressedTimelineFeature = organization.features.includes(
    TRACE_WATERFALL_TIME_COMPRESSION_FEATURE
  );

  const traceProject = getTraceProject(projects, props.rootEventResults);
  const selectOptions: Array<SelectOption<string>> = [
    {
      label: t('Autogrouping'),
      value: 'autogroup',
      details: t(
        'Collapses 5 or more sibling spans with the same description or any spans with 2 or more descendants with the same operation.'
      ),
    },
    {
      label: t('No Instrumentation'),
      value: 'no-instrumentation',
      details: tct(
        'Shows when there is more than 100ms of unaccounted elapsed time between two spans.[link: Go to docs to instrument more.]',
        {
          link: <ExternalLink href={getCustomInstrumentationLink(traceProject)} />,
        }
      ),
    },
  ];
  if (hasCompressedTimelineFeature) {
    selectOptions.push({
      label: t('Compressed Timeline'),
      value: 'compressed-timeline',
      details: t('Collapses long inactive gaps in the waterfall timeline.'),
    });
  }

  const values = useMemo(() => {
    const value: string[] = [];
    if (props.autogroup) {
      value.push('autogroup');
    }
    if (props.missingInstrumentation) {
      value.push('no-instrumentation');
    }
    if (hasCompressedTimelineFeature && props.compressedTimeline) {
      value.push('compressed-timeline');
    }
    return value;
  }, [
    hasCompressedTimelineFeature,
    props.autogroup,
    props.compressedTimeline,
    props.missingInstrumentation,
  ]);

  const onAutogroupChange = props.onAutogroupChange;
  const onMissingInstrumentationChange = props.onMissingInstrumentationChange;
  const onCompressedTimelineChange = props.onCompressedTimelineChange;

  const onChange = useCallback(
    (newValues: Array<SelectOption<string>>) => {
      const newValuesArray = newValues.map(v => v.value);

      if (values.length < newValuesArray.length) {
        const newOption = newValuesArray.find(v => !values.includes(v));
        if (newOption === 'autogroup') {
          onAutogroupChange();
        }
        if (newOption === 'no-instrumentation') {
          onMissingInstrumentationChange();
        }
        if (newOption === 'compressed-timeline') {
          onCompressedTimelineChange();
        }
      }

      if (values.length > newValuesArray.length) {
        const removedOption = values.find(v => !newValuesArray.includes(v));
        if (removedOption === 'autogroup') {
          onAutogroupChange();
        }
        if (removedOption === 'no-instrumentation') {
          onMissingInstrumentationChange();
        }
        if (removedOption === 'compressed-timeline') {
          onCompressedTimelineChange();
        }
      }
    },
    [
      values,
      onAutogroupChange,
      onCompressedTimelineChange,
      onMissingInstrumentationChange,
    ]
  );

  return (
    <CompactSelect
      multiple
      value={values}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          aria-label={t('Trace Preferences')}
          icon={<IconSettings />}
        />
      )}
      options={selectOptions}
      menuFooter={
        <MenuComponents.CTAButton
          onClick={() => {
            traceAnalytics.trackViewShortcuts(organization);
            openModal(p => <TraceShortcutsModal {...p} />);
          }}
        >
          {t('See Shortcuts')}
        </MenuComponents.CTAButton>
      }
      onChange={onChange}
      menuWidth={300}
    />
  );
}

function getTraceProject(
  projects: Project[],
  rootEventResults: TraceRootEventQueryResults
): Project | undefined {
  if (!rootEventResults.data) {
    return undefined;
  }

  if (isTraceItemDetailsResponse(rootEventResults.data)) {
    const attributes = rootEventResults.data.attributes;
    const projectId =
      OurLogKnownFieldKey.PROJECT_ID in attributes
        ? attributes[OurLogKnownFieldKey.PROJECT_ID]
        : findSpanAttributeValue(attributes, 'project_id');
    return projects.find(p => p.id === projectId);
  }

  const projectSlug = rootEventResults.data.projectSlug;
  return projects.find(p => p.slug === projectSlug);
}
