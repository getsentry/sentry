import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SamplingModeField} from 'sentry/views/settings/dynamicSampling/samplingModeField';

export function ProjectSampling() {
  return (
    <form onSubmit={event => event.preventDefault()}>
      <Panel>
        <PanelHeader>{t('Manual Sampling')}</PanelHeader>
        <PanelBody>
          <FieldGroup
            label={t('Sampling Mode')}
            help={t('The current configuration mode for dynamic sampling.')}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: ${space(1)};
              `}
            >
              {t('Manual')}{' '}
              <QuestionTooltip
                size="sm"
                isHoverable
                title={tct(
                  'Manual mode allows you to set fixed sample rates for each project. [link:Learn more]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/performance/retention-priorities/" />
                    ),
                  }
                )}
              />
            </div>
          </FieldGroup>
          <SamplingModeField />
        </PanelBody>
      </Panel>
      <HeadingRow>
        <h4>Customize Projects</h4>
      </HeadingRow>
      <CommingSoonPanel>Coming soon</CommingSoonPanel>
      <FormActions>
        <Button disabled>{t('Reset')}</Button>
        <Button priority="primary" disabled>
          {t('Apply Changes')}
        </Button>
      </FormActions>
    </form>
  );
}

const FormActions = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: ${space(1)};
  justify-content: flex-end;
  padding-bottom: ${space(4)};
`;

const HeadingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: ${space(1.5)};

  & > h4 {
    margin: 0;
  }
`;

const CommingSoonPanel = styled(Panel)`
  padding: ${space(2)};
  color: ${p => p.theme.subText};
`;
