import React from 'react';

import Category from 'app/components/events/interfaces/breadcrumbs/category';
import {getMeta} from 'app/components/events/meta/metaProxy';

import {Breadcrumb} from './types';
import getBreadcrumbCustomRendererValue from './getBreadcrumbCustomRendererValue';

type Props = {
  breadcrumb: Breadcrumb;
  kvData?: KvData;
  summary: React.ReactNode;
  children?: React.ReactNode;
};

type KvData = {
  [key: string]: any;
};

const CrumbTable = ({children, kvData, breadcrumb, summary}: Props) => {
  const renderData = () => {
    if (!kvData) {
      return null;
    }
    return Object.keys(kvData).map(key => (
      <tr key={key}>
        <td className="key">{key}</td>
        <td className="value">
          <pre>
            {getBreadcrumbCustomRendererValue({
              value:
                typeof kvData[key] === 'object'
                  ? JSON.stringify(kvData[key])
                  : kvData[key],
              meta: getMeta(kvData, key),
            })}
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
            <Category value={breadcrumb.category} />
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
