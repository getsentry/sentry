import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {IconGithub} from 'sentry/icons';
import {space} from 'sentry/styles/space';

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
  width: 100%;
  max-width: 1257px;
`;

const HeaderSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  margin-top: ${space(2)};
`;

const Title = styled('h2')`
  font-family: Rubik, sans-serif;
  font-weight: 600;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -0.64%;
  color: #2b2233;
  margin: 0;
`;

const Description = styled('p')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 1.4;
  color: #71637e;
  margin: 0;
`;

const StyledLink = styled(ExternalLink)`
  color: #2562d4;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const CodeViewer = styled('div')`
  background: #ffffff;
  border: 1px solid #e0dce5;
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
  max-width: 1257px;
`;

const FileHeader = styled('div')`
  background: #faf9fb;
  border-bottom: 1px solid rgba(45, 0, 85, 0.06);
  padding: 10px 12px;
`;

const FileHeaderContent = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FileName = styled('span')`
  font-family: Rubik, sans-serif;
  font-weight: 400;
  font-size: 12px;
  line-height: 1.18;
  color: #3e3446;
`;

const CodeBlock = styled('div')`
  border-top: 1px solid rgba(45, 0, 85, 0.06);
`;

const CodeLine = styled('div')`
  display: flex;
  align-items: stretch;
  min-height: 26px;
`;

const LineNumber = styled('div')`
  display: flex;
  align-items: center;
  justify-content: right;
  width: 48px;
  padding: 0 8px;
  border-right: 1px solid #e0dce5;
  background: #ffffff;
  font-family: 'Roboto Mono', monospace;
  font-weight: 400;
  font-size: 13px;
  line-height: 2em;
  color: #3e3446;
  flex-shrink: 0;
`;

const CodeContent = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-family: 'Roboto Mono', monospace;
  font-weight: 425;
  font-size: 13px;
  line-height: 2em;
  color: #3e3446;
  flex: 1;
`;

const YamlKey = styled('span')`
  color: #3e3446;
`;

const YamlValue = styled('span')`
  color: #d73a49;
`;

const YamlNumber = styled('span')`
  color: #005cc5;
`;

const YamlString = styled('span')`
  color: #032f62;
`;

export default function CommitYamlPage() {
  return (
    <LayoutGap>
      <HeaderSection>
        <Title>View repository YAML for this commit</Title>
        <Description>
          Review the settings for this commit. The repository-level YAML takes priority
          over your <StyledLink href="#">global YAML</StyledLink>, if both are configured.
          To learn more about Sentry YAML setup, please visit{' '}
          <StyledLink href="#">our doc</StyledLink>.
        </Description>
      </HeaderSection>

      <CodeViewer>
        <FileHeader>
          <FileHeaderContent>
            <IconGithub size="xs" color="gray300" />
            <FileName>./gazebo/.github/workflow/sentry-prevent.yml</FileName>
          </FileHeaderContent>
        </FileHeader>

        <CodeBlock>
          <CodeLine>
            <LineNumber>1</LineNumber>
            <CodeContent>
              <YamlKey>ai_pr_review</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>2</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>enabled</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>3</LineNumber>
            <CodeContent>
              <YamlKey>sentry-prevent</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>4</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>notify</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>5</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>wait_for_ci</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>6</LineNumber>
            <CodeContent>
              {'   '}
              <YamlKey>require_ci_to_pass</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>7</LineNumber>
            <CodeContent>
              <YamlKey>comment</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>8</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>after_n_builds</YamlKey>: <YamlNumber>9</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>9</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>behavior</YamlKey>: <YamlValue>default</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>10</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>layout</YamlKey>:{' '}
              <YamlValue>diff, flags, files, components, footer</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>11</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>require_base</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>12</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>require_changes</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>13</LineNumber>
            <CodeContent>
              {'  - '}
              <YamlNumber>0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>14</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>require_head</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>15</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>show_carryforward_flags</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>16</LineNumber>
            <CodeContent>
              <YamlKey>component_management</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>17</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>default_rules</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>18</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>statuses</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>19</LineNumber>
            <CodeContent>
              {'    - '}
              <YamlKey>branches</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>20</LineNumber>
            <CodeContent>
              {'      - '}
              <YamlString>^!main$</YamlString>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>21</LineNumber>
            <CodeContent>
              {'      '}
              <YamlKey>target</YamlKey>: <YamlValue>auto</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>22</LineNumber>
            <CodeContent>
              {'      '}
              <YamlKey>type</YamlKey>: <YamlValue>patch</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>23</LineNumber>
            <CodeContent>
              <YamlKey>coverage</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>24</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>precision</YamlKey>: <YamlNumber>2</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>25</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>range</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>26</LineNumber>
            <CodeContent>
              {'  - '}
              <YamlNumber>60.0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>27</LineNumber>
            <CodeContent>
              {'  - '}
              <YamlNumber>85.0</YamlNumber>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>28</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>round</YamlKey>: <YamlValue>down</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>29</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>status</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>30</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>changes</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>31</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>default_rules</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>32</LineNumber>
            <CodeContent>
              {'      '}
              <YamlKey>flag_coverage_not_uploaded_behavior</YamlKey>:{' '}
              <YamlValue>include</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>33</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>patch</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>34</LineNumber>
            <CodeContent>
              {'    '}
              <YamlKey>project</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>35</LineNumber>
            <CodeContent>
              <YamlKey>github_checks</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>36</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>annotations</YamlKey>: <YamlValue>false</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>37</LineNumber>
            <CodeContent>
              <YamlKey>slack_app</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>38</LineNumber>
            <CodeContent>
              <YamlKey>test_analytics</YamlKey>:
            </CodeContent>
          </CodeLine>
          <CodeLine>
            <LineNumber>39</LineNumber>
            <CodeContent>
              {'  '}
              <YamlKey>flake_detection</YamlKey>: <YamlValue>true</YamlValue>
            </CodeContent>
          </CodeLine>
        </CodeBlock>
      </CodeViewer>
    </LayoutGap>
  );
}
