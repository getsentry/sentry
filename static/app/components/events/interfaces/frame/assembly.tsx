import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  culture?: string;
  filePath?: string | null;
  name?: string;
  publicKeyToken?: string;
  version?: string;
};

function Assembly({name, version, culture, publicKeyToken}: Props) {
  return (
    <AssemblyWrapper>
      <Flex align="center" marginRight="xl">
        <Caption>Assembly:</Caption>
        {name || '-'}
      </Flex>
      <Flex align="center" marginRight="xl">
        <Caption>{t('Version')}:</Caption>
        {version || '-'}
      </Flex>

      {culture && (
        <Flex align="center" marginRight="xl">
          <Caption>{t('Culture')}:</Caption>
          {culture}
        </Flex>
      )}

      {publicKeyToken && (
        <Flex align="center" marginRight="xl">
          <Caption>PublicKeyToken:</Caption>
          {publicKeyToken}
        </Flex>
      )}
    </AssemblyWrapper>
  );
}

const AssemblyWrapper = styled('div')`
  font-size: 80%;
  display: flex;
  flex-wrap: wrap;
  color: ${p => p.theme.tokens.content.primary};
  text-align: center;
  position: relative;
  padding: ${space(0.25)} ${space(3)};
`;

const Caption = styled('span')`
  margin-right: 5px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

export {Assembly};
