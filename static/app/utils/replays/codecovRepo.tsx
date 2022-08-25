type TransactionName = string;
type ModuleName = string;
type ExportName = string;
type RefCount = number;

type CodecovModule = Record<ExportName, RefCount>;
type CodecovTransaction = Record<ModuleName, CodecovModule>;
type CodecovTransactions = Record<TransactionName, CodecovTransaction>;

type CodecovImportAttachment = {
  modules: string[];
  timestamp: number;
  type: 'imports';
  url: string;
};
type CodecovModulecallsAttachment = {
  modules: CodecovTransactions;
  timestamp: number;
  type: 'modulecalls';
  url: string;
};
export type ReplayCodecovAttachment =
  | CodecovImportAttachment
  | CodecovModulecallsAttachment;

type CodecovReport = {
  imported: string[];
  transactions: CodecovTransactions;
  unused: string[];
  used: string[];
};

export class CodecovRepo {
  public readonly urls: string[];
  private _reportsByUrl: Record<string, CodecovReport>;

  constructor(codecov: ReplayCodecovAttachment[]) {
    const imports = codecov.filter(
      ({type}) => type === 'imports'
    ) as CodecovImportAttachment[];
    const accesses = codecov.filter(
      ({type}) => type === 'modulecalls'
    ) as CodecovModulecallsAttachment[];

    const transactionsByUrl = Object.fromEntries(
      accesses.map(attachment => [attachment.url, attachment.modules]) // aka attachment.transactions
    );
    const importsByUrl = Object.fromEntries(
      imports.map(attachment => [attachment.url, attachment.modules])
    );

    this.urls = Array.from(
      new Set([...Object.keys(transactionsByUrl), ...Object.keys(importsByUrl)])
    );

    this._reportsByUrl = this.urls.reduce((map, url) => {
      const transactions = transactionsByUrl[url] || {};
      const imported = importsByUrl[url] || [];

      const used = Object.entries(transactions).flatMap(([_txnName, txn]) =>
        Object.keys(txn)
      );

      map[url] = {
        imported,
        transactions,
        unused: getUnusedModules(imported, used),
        used,
      };
      return map;
    }, {} as Record<string, CodecovReport>);
  }

  getReportByUrl(url: keyof typeof this._reportsByUrl) {
    return this._reportsByUrl[url];
  }

  getTransactionsByUrl(url: keyof typeof this._reportsByUrl) {
    const report = this.getReportByUrl(url);
    return Object.keys(report.imported);
  }

  getImportedModulesByUrl(url: keyof typeof this._reportsByUrl) {
    const report = this.getReportByUrl(url);
    return report.imported;
  }

  getUsedModulesByUrl(url: keyof typeof this._reportsByUrl) {
    const report = this.getReportByUrl(url);
    return report.used;
  }

  getUnusedModulesByUrl(url: keyof typeof this._reportsByUrl) {
    const report = this.getReportByUrl(url);
    return report.unused;
  }
}

/** list all the unused modules within these multiple transactions */
function getUnusedModules(imported: string[], used: string[]) {
  return imported.filter(moduleName => !used.includes(moduleName));
}
