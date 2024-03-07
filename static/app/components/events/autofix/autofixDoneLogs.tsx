import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AutofixDoneLogsProps = {
  data: AutofixData;
};

export function AutofixDoneLogs({data}: AutofixDoneLogsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <AfterFixContainer>
      <AccordionHeader onClick={() => setIsExpanded(value => !value)}>
        <AccordionTitle>{t('View Logs')}</AccordionTitle>
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'up' : 'down'} />}
          aria-label={t('Toggle log details')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
        />
      </AccordionHeader>
      {isExpanded ? (
        <AccordionContent>
          <AutofixSteps data={data} />
        </AccordionContent>
      ) : null}
    </AfterFixContainer>
  );
}

const AfterFixContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: ${space(1.5)};
`;

const AccordionTitle = styled('div')`
  font-weight: bold;
`;

const AccordionHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  padding: ${space(1)};
  cursor: pointer;
  user-select: none;
`;

const AccordionContent = styled('div')`
  margin-top: ${space(1)};
`;
