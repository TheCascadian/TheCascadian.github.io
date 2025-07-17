(function () {
    'use strict';
    window.MAP_HASH = crypto.randomUUID();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
    }
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        let url = typeof input === 'string' ? input : input.url;
        if (url.endsWith('map.png') || url.endsWith('mask.png')) {
            const sep = url.includes('?') ? '&' : '?';
            url = `${url}${sep}cb=${window.MAP_HASH}`;
        }
        return origFetch.call(this, url, init);
    };
    const ImgProto = HTMLImageElement.prototype;
    const origSrc = Object.getOwnPropertyDescriptor(ImgProto, 'src');
    Object.defineProperty(ImgProto, 'src', {
        set(v) {
            let url = v;
            if (url.endsWith('map.png') || url.endsWith('mask.png')) {
                const sep = url.includes('?') ? '&' : '?';
                url = `${url}${sep}cb=${window.MAP_HASH}`;
            }
            origSrc.set.call(this, url);
        },
        get() { return origSrc.get.call(this); }
    });
})();
