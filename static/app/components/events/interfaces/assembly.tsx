import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

interface Props {
  name?: string;
  version?: string;
  culture?: string;
  publicKeyToken?: string;
  filePath?: string | null;
}

const Assembly = ({name, version, culture, publicKeyToken, filePath}: Props) => (
  <AssemblyWrapper>
    <AssemblyInfo>
      <Caption>Assembly:</Caption>
      {name || '-'}
    </AssemblyInfo>
    <AssemblyInfo>
      <Caption>{t('Version')}:</Caption>
      {version || '-'}
    </AssemblyInfo>
    <AssemblyInfo>
      <Caption>{t('Culture')}:</Caption>
      {culture || '-'}
    </AssemblyInfo>
    <AssemblyInfo>
      <Caption>PublicKeyToken:</Caption>
      {publicKeyToken || '-'}
    </AssemblyInfo>

    {filePath && (
      <FilePathInfo>
        <Caption>{t('Path')}:</Caption>
        <Tooltip title={filePath}>
          <TextCopyInput rtl>{filePath}</TextCopyInput>
        </Tooltip>
      </FilePathInfo>
    )}
  </AssemblyWrapper>
);

// TODO(ts): we should be able to delete these after disabling react/prop-types rule in tsx functional components

const AssemblyWrapper = styled('div')`
  font-size: 80%;
  display: flex;
  flex-wrap: wrap;
  color: ${p => p.theme.textColor};
  text-align: center;
  position: relative;
  padding: 0 ${space(3)} 0 ${space(3)};
`;

const AssemblyInfo = styled('div')`
  margin-right: 15px;
  margin-bottom: 5px;
`;

const Caption = styled('span')`
  margin-right: 5px;
  font-weight: bold;
`;

const FilePathInfo = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  input {
    width: 300px;
    height: 20px;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 1.5;
    @media (max-width: ${theme.breakpoints[1]}) {
      width: auto;
    }
  }
  button > span {
    padding: 2px 5px;
  }
  svg {
    width: 11px;
    height: 11px;
  }
`;

export {Assembly};
