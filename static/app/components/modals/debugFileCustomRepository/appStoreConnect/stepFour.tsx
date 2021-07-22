import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {IconInfo, IconMobile, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {StepFourData} from './types';

type Props = {
  onStartItunesAuthentication: (startItunesAuthentication: boolean) => void;
  onStartSmsAuthentication: () => void;
  stepFourData: StepFourData;
  onSetStepFourData: (stepFourData: StepFourData) => void;
};

function StepFour({
  onStartItunesAuthentication,
  onStartSmsAuthentication,
  stepFourData,
  onSetStepFourData,
}: Props) {
  return (
    <Fragment>
      <StyledAlert type="info" icon={<IconInfo />}>
        <AlertContent>
          {t('Did not get a verification code?')}
          <ButtonBar gap={1}>
            <Button
              size="small"
              title={t('Get a new verification code')}
              onClick={() => onStartItunesAuthentication(false)}
              icon={<IconRefresh />}
            >
              {t('Resend code')}
            </Button>
            <Button
              size="small"
              title={t('Get a text message with a code')}
              onClick={() => onStartSmsAuthentication()}
              icon={<IconMobile />}
            >
              {t('Text me')}
            </Button>
          </ButtonBar>
        </AlertContent>
      </StyledAlert>
      <Field
        label={t('Two Factor authentication code')}
        inline={false}
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="text"
          name="two-factor-authentication-code"
          placeholder={t('Enter your code')}
          value={stepFourData.authenticationCode}
          onChange={e =>
            onSetStepFourData({
              ...stepFourData,
              authenticationCode: e.target.value,
            })
          }
        />
      </Field>
    </Fragment>
  );
}

export default StepFour;

const StyledAlert = styled(Alert)`
  div {
    align-items: flex-start;
  }
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    div {
      align-items: center;
    }
  }
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr max-content;
  }
`;
