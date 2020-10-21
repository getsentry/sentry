import omit from 'lodash/omit';

import {getMeta} from 'app/components/events/meta/metaProxy';
import {defined} from 'app/utils';
import Highlight from 'app/components/highlight';
import AnnotatedText from 'app/components/events/meta/annotatedText';

import {BreadcrumbTypeDefault} from '../types';
import Summary from './summary';

type Props = {
  searchTerm: string;
  breadcrumb: BreadcrumbTypeDefault;
};

const Exception = ({breadcrumb, searchTerm}: Props) => {
  const {data} = breadcrumb;
  const dataValue = data?.value;

  return (
    <Summary kvData={omit(data, ['type', 'value'])} searchTerm={searchTerm}>
      {data?.type && (
        <AnnotatedText
          value={
            <strong>
              <Highlight text={searchTerm}>{`${data.type}: `}</Highlight>
            </strong>
          }
          meta={getMeta(data, 'type')}
        />
      )}
      {defined(dataValue) && (
        <AnnotatedText
          value={
            <Highlight text={searchTerm}>
              {breadcrumb?.message ? `${dataValue}. ` : dataValue}
            </Highlight>
          }
          meta={getMeta(data, 'value')}
        />
      )}
      {breadcrumb?.message && (
        <AnnotatedText
          value={<Highlight text={searchTerm}>{breadcrumb.message}</Highlight>}
          meta={getMeta(breadcrumb, 'message')}
        />
      )}
    </Summary>
  );
};

export default Exception;
