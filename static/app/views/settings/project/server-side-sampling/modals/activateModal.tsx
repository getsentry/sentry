import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import Link from 'sentry/components/links/link';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SamplingRule} from 'sentry/types/sampling';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from '../utils';

type Props = ModalRenderProps & {
  rule: SamplingRule;
};

export function ActivateModal({Header, Body, Footer, closeModal}: Props) {
  const [understandConsequences, setUnderstandConsequences] = useState(false);

  function handleActivate() {
    // TODO(sampling): add activation logic here
    try {
      closeModal();
    } catch {
      // to nothing
    }
  }

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Activate Rule')}</h4>
      </Header>
      <Body>
        <Alert type="error" showIcon icon={<IconWarning />}>
          {tct(
            'Applying server-side sampling without first updating the Sentry SDK versions could sharply decrease the amount of accepted transactions. [link:Resolve now].',
            {
              // TODO(sampling): Add a link to the second step of the wizard once it is implemented
              link: <Link to="" />,
            }
          )}
        </Alert>
        <Field>
          <CheckboxFancy
            isChecked={understandConsequences}
            onClick={() => setUnderstandConsequences(!understandConsequences)}
            aria-label={
              understandConsequences ? t('Uncheck to disagree') : t('Check to agree')
            }
          />
          <FieldLabel>{t('I understand the consequences\u2026')}</FieldLabel>
          <FieldRequiredBadge />
        </Field>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_SAMPLING_DOC_LINK} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              priority="danger"
              disabled={!understandConsequences}
              title={
                !understandConsequences
                  ? t('Required fields must be filled out')
                  : undefined
              }
              onClick={handleActivate}
            >
              {t('Activate Rule')}
            </Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}

const FooterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

const Field = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  align-items: flex-start;
  line-height: 1;
`;

const FieldLabel = styled('div')`
  margin-left: ${space(1)};
  /* match the height of the checkbox */
  line-height: 16px;
`;
