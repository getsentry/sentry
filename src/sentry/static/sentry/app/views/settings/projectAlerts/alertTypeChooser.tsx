import React from 'react';
import styled from '@emotion/styled';

import Card from 'app/components/card';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import Radio from 'app/components/radio';
import textStyles from 'app/styles/text';
import BulletList from 'app/styles/bulletList';
import FeatureBadge from 'app/components/featureBadge';
import Tooltip from 'app/components/tooltip';
import Feature from 'app/components/acl/feature';

type Props = {
  selected?: string | null;
  onChange: (type: string) => void;
};

const IssuesTooltip = ({children}: {children?: React.ReactNode}) => (
  <Tooltip
    title={t(
      `An Issue is a unique error in Sentry, created by grouping error events based on stack trace and other factors.`
    )}
  >
    <abbr>{children}</abbr>
  </Tooltip>
);

const AlertTypeChooser = ({selected, onChange}: Props) => (
  <Container>
    <TypeCard interactive onClick={() => onChange('metric')}>
      <RadioLabel>
        <Radio
          aria-label="metric"
          checked={selected === 'metric'}
          onChange={() => onChange('metric')}
        />
        {t('Metric Alert')}
        <FeatureBadge type="beta" />
      </RadioLabel>
      <p>
        <Feature
          requireAll
          features={[
            'organizations:transaction-events',
            'organizations:incidents-performance',
          ]}
        >
          {({hasFeature}) =>
            hasFeature
              ? tct(
                  `Alert on performance metrics like latency, or total error count across multiple [note:Issues], in any part of your app.`,
                  {note: <IssuesTooltip />}
                )
              : tct(
                  `Alert on metrics like total error count across multiple [note:Issues], in any part of your app.`,
                  {note: <IssuesTooltip />}
                )
          }
        </Feature>
      </p>
      {!selected && (
        <BulletList>
          <Feature
            requireAll
            features={[
              'organizations:transaction-events',
              'organizations:incidents-performance',
            ]}
          >
            <li>
              {t('Performance metrics')}
              <Example>{t('Latency, transaction volume, apdex, error rate')}</Example>
            </li>
          </Feature>
          <li>
            {t('Errors across issues')}
            <Example>{t('100 or more errors with "database" in the title')}</Example>
            <Example>{t('1000 or more errors in the entire project')}</Example>
          </li>
        </BulletList>
      )}
    </TypeCard>
    <TypeCard interactive onClick={() => onChange('issue')}>
      <RadioLabel>
        <Radio
          aria-label="issue"
          checked={selected === 'issue'}
          onChange={() => onChange('issue')}
        />
        {t('Issue Alert')}
      </RadioLabel>
      <p>
        {t(`Get notified when individual Sentry Issues match your alerting criteria.`)}
      </p>
      {!selected && (
        <BulletList>
          <li>
            {t('New or regressed issues')}
            <Example>{t('New issue on the checkout page')}</Example>
          </li>
          <li>
            {t('Issue frequency')}
            <Example>{t('Issue affecting more than X users')}</Example>
          </li>
        </BulletList>
      )}
    </TypeCard>
  </Container>
);

const RadioLabel = styled('label')`
  cursor: pointer;
  margin-bottom: ${space(3)};
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  align-items: center;
  grid-gap: ${space(2)};
`;

const Example = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray700};
  font-style: italic;
`;

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(3)};
`;

const TypeCard = styled(Card)`
  cursor: pointer;
  padding: ${space(4)};
  margin-bottom: ${space(3)};
  ${textStyles};
`;

export default AlertTypeChooser;
