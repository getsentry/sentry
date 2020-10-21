import { Component } from 'react';
import styled from '@emotion/styled';

import {tct, t} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';
import Button from 'app/components/button';
import {Panel} from 'app/components/panels';
import space from 'app/styles/space';

type IntroProps = {
  updateQuery: (query: any) => void;
};

export default class Intro extends Component<IntroProps> {
  getExampleQueries() {
    return [
      {
        title: t('Events by stack filename'),
        description: 'What is my most problematic code?',
        query: {
          fields: ['stack.filename'],
          aggregations: [['count()', null, 'count']],
          conditions: [],
          orderby: '-count',
        },
      },
      {
        title: t('Unique issues by user'),
        description: t("Who's having the worst time?"),
        query: {
          fields: ['user.id', 'user.username', 'user.email', 'user.ip'],
          aggregations: [['uniq', 'issue.id', 'uniq_issue_id']],
          conditions: [],
          orderby: '-uniq_issue_id',
        },
      },
      {
        title: t('Events by geography'),
        description: 'Are my services less reliable in some regions?',
        query: {
          fields: ['geo.country_code', 'geo.region', 'geo.city'],
          aggregations: [['count()', null, 'count']],
          conditions: [],
          orderby: '-count',
        },
      },
    ];
  }

  render() {
    return (
      <IntroContainer>
        <Content>
          <Heading>{t('Discover lets you query raw event data in Sentry')}</Heading>
          <TextBlock>
            {tct(
              `Getting started? Try running one of the example queries below.
            To learn more about how to use the query builder, [docs:see the docs].`,
              {
                docs: <ExternalLink href="https://docs.sentry.io/product/discover/" />,
              }
            )}
          </TextBlock>
          <TextBlock>
            {this.getExampleQueries().map(({title, description, query}, idx) => (
              <ExampleQuery key={idx}>
                <div>
                  <div>{title}</div>
                  <ExampleQueryDescription>{description}</ExampleQueryDescription>
                </div>
                <div>
                  <Button
                    size="small"
                    onClick={() => {
                      this.props.updateQuery(query);
                    }}
                  >
                    {t('Run')}
                  </Button>
                </div>
              </ExampleQuery>
            ))}
          </TextBlock>
        </Content>
      </IntroContainer>
    );
  }
}

const IntroContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray800};
  width: 100%;
  height: 100%;
  min-height: 420px;
  min-width: 500px;
`;

const Content = styled('div')`
  max-width: 560px;
`;

const Heading = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 700;
  margin: 0 0 20px;
`;

const TextBlock = styled('div')`
  margin: 0 0 20px;
`;

const ExampleQuery = styled(Panel)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(2)};
`;
const ExampleQueryDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
`;
