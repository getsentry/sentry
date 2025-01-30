import {Fragment, useMemo} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

export function VisualizeSection() {
  const numberTags = useSpanTags('number');

  const fieldOptions: Array<SelectOption<string>> = useMemo(() => {
    const options = Object.values(numberTags).map(tag => {
      return {
        label: tag.name,
        value: tag.key,
        textValue: tag.name,
      };
    });

    options.sort((a, b) => {
      if (a.label < b.label) {
        return -1;
      }

      if (a.label > b.label) {
        return 1;
      }

      return 0;
    });

    return options;
  }, [numberTags]);

  const aggregateOptions: Array<SelectOption<string>> = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => {
      return {
        label: aggregate,
        value: aggregate,
        textValue: aggregate,
      };
    });
  }, []);

  return (
    <Section data-test-id="section-visualize">
      <SectionHeader>
        <Tooltip
          position="right"
          title={t(
            'Primary metric that appears in your chart. You can also overlay a series onto an existing chart or add an equation.'
          )}
        >
          <SectionLabel>{t('Visualize')}</SectionLabel>
        </Tooltip>
      </SectionHeader>
      <Fragment>
        <PageFilterBar>
          <CompactSelect
            searchable
            options={fieldOptions}
            value={''}
            onChange={_newField => {}}
          />
          <CompactSelect
            options={aggregateOptions}
            value={''}
            onChange={_newAggregate => {}}
          />
        </PageFilterBar>
      </Fragment>
    </Section>
  );
}
