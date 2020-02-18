import React from 'react';

import Category from 'app/components/events/interfaces/breadcrumbs/category';
import {getMeta} from 'app/components/events/meta/metaProxy';

import {Crumb} from './types';
import BreadcrumbCustomRendererValue from './breadcrumbCustomRendererValue';

type Props = {
  crumb: Crumb;
  kvData?: {};
  summary: React.ReactElement;
  children?: React.ReactNode;
};

const CrumbTable = ({children, kvData, crumb, summary}: Props) => {
  const renderData = () => {
    if (!kvData) {
      return null;
    }
    return Object.keys(kvData).map(key => (
      <tr key={key}>
        <td className="key">{key}</td>
        <td className="value">
          <pre>
            <BreadcrumbCustomRendererValue
              value={
                typeof kvData[key] === 'object'
                  ? JSON.stringify(kvData[key])
                  : kvData[key]
              }
              meta={getMeta(kvData, key)}
            />
          </pre>
        </td>
      </tr>
    ));
  };

  return (
    <table className="table key-value">
      <thead>
        <tr>
          <td className="key">
            <Category value={crumb.category} />
          </td>
          <td className="value">{summary}</td>
        </tr>
      </thead>
      <tbody>
        {children}
        {renderData()}
      </tbody>
    </table>
  );
};

export default CrumbTable;
