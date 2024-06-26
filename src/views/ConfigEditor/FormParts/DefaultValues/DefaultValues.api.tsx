import {getBackendSrv} from '@grafana/runtime';


export const getOptions = (query: string, url: string): Promise<any> => {
  const backendSrv = getBackendSrv();
  if (!url || !query) {
    return Promise.reject('Invalid parameters')
  }

  return new Promise((resolve, reject) => {
    backendSrv.fetch({
      url: url,
      requestId: 'requestId',
      method: 'POST',
      data: query,
    }).subscribe((response) => {
      resolve(response.data)
    },(e) => {
      reject(e)
    })
  })
}
