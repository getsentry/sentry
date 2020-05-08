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

type Props = {
  selected?: string | null;
  onChange: (type: string) => void;
};

const IssuesTooltip = ({children}: {children?: React.ReactNode}) => (
  <Tooltip
    title={t(
      `Sentry automatically groups similar errors into issues. Similarity is
       determined by stack trace and other factors.`
    )}
  >
    <abbr>{children}</abbr>
  </Tooltip>
);

const AlertTypeChooser = ({selected, onChange}: Props) => (
  <Container>
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
        {tct(
          `Get notified when [note:individual Sentry Issues] match your alerting criteria.`,
          {note: <IssuesTooltip />}
        )}
      </p>
      {!selected && (
        <BulletList>
          <li>
            {t('New or regressed issues')}
            <Example>{t('There is a new issue on the checkout page')}</Example>
          </li>
          <li>
            {t('Issue frequency')}
            <Example>{t('When an issue affects more than X users')}</Example>
          </li>
        </BulletList>
      )}
    </TypeCard>
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
        {t(
          `Compute aggregates and set thresholds on any or all errors in your
           project, regardless of the Sentry issue.`
        )}
      </p>
      {!selected && (
        <BulletList>
          <li>
            {t('Overall error volume')}
            <Example>{t('A broken service is affecting more than X users')}</Example>
          </li>
          <li>
            {t('Events across issues')}
            <Example>{t('100 or more errors with "database" in the title')}</Example>
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
  color: ${p => p.theme.gray4};
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
