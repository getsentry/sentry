import {useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';

export interface CodeSnippetTab {
  code: string;
  label: string;
  language: string;
  value: string;
  filename?: string;
}

interface TabbedCodeSnippetProps {
  /**
   * An array of tabs to be displayed
   */
  tabs: CodeSnippetTab[];
}

export function TabbedCodeSnippet({tabs}: TabbedCodeSnippetProps) {
  const [selectedTabValue, setSelectedTabValue] = useState(tabs[0].value);
  const selectedTab = tabs.find(tab => tab.value === selectedTabValue) ?? tabs[0];
  const {code, language, filename} = selectedTab;

  return (
    <StyledCodeSnippet
      dark
      tabs={tabs}
      language={language}
      hideCopyButton={false}
      selectedTab={selectedTabValue}
      onTabClick={value => setSelectedTabValue(value)}
      filename={filename}
    >
      {code}
    </StyledCodeSnippet>
  );
}

const StyledCodeSnippet = styled(CodeSnippet)`
  width: auto;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 100%;
  }
`;
