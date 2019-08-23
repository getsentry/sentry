import React from 'react';
import {Location} from 'history';
import {isString, pick} from 'lodash';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import {DEFAULT_PER_PAGE} from 'app/constants';

import {EventQuery} from './utils';

type Field = [/* col name */ string, /* field name */ string, /* table width */ number];

const isValidField = (maybe: any): boolean => {
  if (!Array.isArray(maybe)) {
    return false;
  }

  if (maybe.length !== 3) {
    return false;
  }

  const validTypes =
    isString(maybe[0]) &&
    isString(maybe[1]) &&
    typeof maybe[2] === 'number' &&
    isFinite(maybe[2]);

  return validTypes;
};

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
};

class Discover2Table extends React.PureComponent<Props> {
  getFields = (): Array<Field> => {
    const {query} = this.props.location;

    if (!query || !query.field) {
      return [];
    }

    const field: Array<string> = isString(query.field) ? [query.field] : query.field;

    return field.reduce((acc: Array<Field>, field: string) => {
      try {
        const result = JSON.parse(field);

        if (isValidField(result)) {
          acc.push(result);
          return acc;
        }
      } catch (_err) {
        // no-op
      }

      return acc;
    }, []);
  };

  componentDidMount() {
    this.fetchData();
  }

  getQuery = () => {
    const {query} = this.props.location;

    // TODO: consolidate this

    type LocationQuery = {
      project?: string;
      environment?: string;
      start?: string;
      end?: string;
      utc?: string;
      statsPeriod?: string;
      cursor?: string;
      sort?: string;
    };

    const picked = pick<LocationQuery>(query || {}, [
      'project',
      'environment',
      'start',
      'end',
      'utc',
      'statsPeriod',
      'cursor',
      'sort',
    ]);

    const fieldNames = this.getFields().map(field => {
      return field[1];
    });

    const defaultSort = fieldNames.length > 0 ? [fieldNames[0]] : undefined;

    const eventQuery: EventQuery = Object.assign(picked, {
      field: [...new Set(fieldNames)],
      sort: picked.sort ? picked.sort : defaultSort,
      per_page: DEFAULT_PER_PAGE,
      // TODO: fix this
      query: '',
      // query: getQueryString(view, location),
    });

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  };

  fetchData = () => {
    const {organization} = this.props;

    const url = `/organizations/${organization.slug}/eventsv2/`;

    console.log('this.getQuery()', this.getQuery());

    this.props.api.request(url, {
      query: this.getQuery(),
      success: (data, textStatus, jqxhr) => {
        console.log('data', data);
        // const projectMap = {};
        // data.forEach(project => {
        //   projectMap[project.id] = project;
        // });
        // this.setState(prevState => {
        //   return {
        //     pageLinks: jqxhr.getResponseHeader('Link'),
        //     projectMap,
        //     projectsRequestsPending: prevState.projectsRequestsPending - 1,
        //   };
        // });
      },
      error: () => {
        // this.setState({
        //   projectsError: true,
        // });
      },
    });

    console.log('Discover2Table', this.getFields());
  };

  render() {
    // TODO: remove
    // const field_1 = JSON.stringify(['foo', 'bar', 34.5]);
    // const field_2 = JSON.stringify(['baz', 'qux', 50]);

    // const result = qs.stringify({
    //   field: [field_1, field_2],
    // });

    // console.log('result', result);

    return <div>foo</div>;
  }
}

export default withApi(Discover2Table);
