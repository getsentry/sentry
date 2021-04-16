import React from 'react';
import styled from '@emotion/styled';

import NotAvailable from 'app/components/notAvailable';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Image} from 'app/types/debugImage';

import Processings from '../debugImage/processings';
import {getImageAddress} from '../utils';

type Props = {
  image?: Image;
};

function GeneralInfo({image}: Props) {
  const {debug_id, debug_file, code_id, code_file, arch, unwind_status, debug_status} =
    image ?? {};

  const imageAddress = image ? getImageAddress(image) : undefined;

  return (
    <Wrapper>
      <Label coloredBg>{t('Address Range')}</Label>
      <Value coloredBg>{imageAddress ?? <NotAvailable />}</Value>

      <Label>{t('Debug ID')}</Label>
      <Value>{debug_id ?? <NotAvailable />}</Value>

      <Label coloredBg>{t('Debug File')}</Label>
      <Value coloredBg>{debug_file ?? <NotAvailable />}</Value>

      <Label>{t('Code ID')}</Label>
      <Value>{code_id ?? <NotAvailable />}</Value>

      <Label coloredBg>{t('Code File')}</Label>
      <Value coloredBg>{code_file ?? <NotAvailable />}</Value>

      <Label>{t('Architecture')}</Label>
      <Value>{arch ?? <NotAvailable />}</Value>

      <Label coloredBg>{t('Processing')}</Label>
      <Value coloredBg>
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Value>
    </Wrapper>
  );
}

export default GeneralInfo;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
`;

const Label = styled('div')<{coloredBg?: boolean}>`
  color: ${p => p.theme.textColor};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;

const Value = styled(Label)`
  white-space: pre-wrap;
  word-break: break-all;
  color: ${p => p.theme.subText};
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
`;
