const koakumaTemplate = `
<div id="こあくま">
	<div>{{ l10n.koakumaProcessed(library.length) }}</div>
	<koakuma-bookmark :l10n="l10n"
		:limit="filters.limit"
		@limitUpdate="limitUpdate"></koakuma-bookmark>
	<button id="koakuma-switch"
		@click="switchSearching"
		:disabled="isEnded"
		:class="switchStyle">{{ switchText }}</button>
	<koakuma-settings :l10n="l10n"
		:favorite="favorite"
		@fullwidthUpdate="fullwidthUpdate"
		@sortUpdate="sortUpdate"></koakuma-settings>
</div>`;
const koakuma = new Vue({
	data: {
		l10n: global.l10n,
		library: global.library,
		filters: global.filters,
		api: global.api,
		favorite: global.favorite,
		pagetype: global.pagetype,
		next_url: location.href,
		isStoped: true,
		isEnded: false,
		local_ids_q: [],
		bookmark_ids: {},
	},
	computed: {
		library_iids() {
			return this.library.map(x => x.illust_id);
		},
		switchText() {
			return this.isEnded ? this.l10n.koakumaEnd :
				(this.isStoped ? this.l10n.koakumaGo : this.l10n.koakumaPause);
		},
		switchStyle() {
			return {
				ended: this.isEnded,
				toSearch: !this.isEnded && this.isStoped,
				toStop: !this.isEnded && !this.isStoped,
			};
		},
	},
	methods: {
		async start(times = Infinity) {
			this.isStoped = false;
			const toContinue = () => {
				return !this.isEnded && !this.isStoped && times > 0 &&
					(this.next_url || this.local_ids_q.length);
			};
			while (toContinue()) {
				// get illust_ids and next_url
				if (this.next_url) {
					if (this.pagetype.RECOMMEND) {
						if (this.next_url !== '') {
							const res = await this.api.getRecommendIllustids();
							this.next_url = '';
							this.local_ids_q.push(...res);
						}
					} else {
						const res = await this.api.getPageIllustids(this.next_url, this.pagetype.MYBOOKMARK);
						console.debug('res', res);
						if (res.next_url === this.next_url) {
							// debounce
							this.stop();
							break;
						}
						this.next_url = res.next_url;
						this.local_ids_q.push(...res.illust_ids);
						if (this.pagetype.MYBOOKMARK) {
							Object.assign(this.bookmark_ids, res.bookmark_ids);
						}
					}
				}

				//get illust_ids from local_ids_q
				const process_ids = this.local_ids_q.slice(0, 20)
					.filter(id => !this.library_iids.includes(id));
				this.local_ids_q.splice(0, 20);

				if (process_ids.length) {
					const ild = await this.api.getIllustsDetail(process_ids);
					for (let k in ild) {
						if (ild[k].error) {
							delete ild[k];
						}
					}
					const iids = Object.values(ild).map(x => x.illust_id);
					// const ipd = await this.api.getIllustPagesDetail(iids);
					const bd = await this.api.getBookmarksDetail(iids);

					const uids = [];
					for(let d of Object.values(ild)) {
						if (!uids.includes(d.user_id)) {
							uids.push(d.user_id);
						}
					}
					const ud = await this.api.getUsersDetail(uids);

					for (let iid of iids) {
						const illust = ild[iid];
						const book = {
							illust_id: iid,
							thumb_src: illust.url['240mw'].replace('240x480', '150x150'),
							user_id: illust.user_id,
							user_name: illust.user_name,
							illust_title: illust.illust_title,
							is_multiple: illust.is_multiple,
							is_bookmarked: illust.is_bookmarked,
							is_manga: illust.illust_type === '1',
							is_ugoira: !!illust.ugoira_meta,
							is_follow: ud[illust.user_id].is_follow,
							bookmark_count: bd[iid].bookmark_count,
							// tags: bd[iid].somehow,
							// rating_score: ipd[iid].rating_score,
						}
						if (this.pagetype.MYBOOKMARK) {
							book.bookmark_id = this.bookmark_ids[iid];
							delete this.bookmark_ids[iid];
						}
						this.library.push(book);
					}
				}
				times--;
			}
			// End of while
			if (this.next_url === '') {
				this.stop();
				this.isEnded = this.local_ids_q.length <= 0;
				if (this.isEnded) {
					delete this.bookmark_ids;
					delete this.local_ids_q;
				}
			}
			if (times <= 0) {
				this.stop();
			}
		},
		stop() {
			this.isStoped = true;
		},
		switchSearching() {
			if (this.isStoped) {
				this.start();
			} else {
				this.stop();
			}
		},
		limitUpdate(value) {
			global.filters.limit = isNaN(value) ? 0 : value;
		},
		fullwidthUpdate(todo) {
			if (todo) {
				document.querySelector('#wrapper').classList.add('fullwidth');
				global.favorite.fullwidth = 1;
			} else {
				document.querySelector('#wrapper').classList.remove('fullwidth');
				global.favorite.fullwidth = 0;
			}
			Pixiv.storageSet(global.favorite);
		},
		sortUpdate(todo) {
			if (todo) {
				global.filters.orderBy = 'bookmark_count';
				global.favorite.sort = 1;
			} else {
				global.filters.orderBy = 'illust_id';
				global.favorite.sort = 0;
			}
			Pixiv.storageSet(global.favorite);
		},
	},
	template: koakumaTemplate,
});
if (!global.pagetype.NOSUP) {
	utils.addStyle(`
	#wrapper.fullwidth,
	#wrapper.fullwidth .layout-a,
	#wrapper.fullwidth .layout-body {
		width: initial;
	}
	#wrapper.fullwidth .layout-a {
		display: flex;
		flex-direction: row-reverse;
	}
	#wrapper.fullwidth .layout-column-2{
		flex: 1;
		margin-left: 20px;
	}
	#wrapper.fullwidth .layout-body,
	#wrapper.fullwidth .layout-a {
		margin: 10px 20px;
	}

	#koakuma-bookmark {
		display: flex;
	}
	#koakuma-bookmark label{
		white-space: nowrap;
		color: #0069b1 !important;
		background-color: #cceeff;
		border-radius: 3px;
		padding: 0 6px;
	}
	#koakuma-bookmark-input::-webkit-inner-spin-button,
	#koakuma-bookmark-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	#koakuma-bookmark-input {
		-moz-appearance: textfield;
		border: none;
		background-color: transparent;
		padding: 0px;
		color: blue;
		font-size: 16px;
		display: inline-block;
		cursor: ns-resize;
		text-align: center;
		min-width: 0;
	}
	#koakuma-bookmark-input:focus {
		cursor: initial;
	}
	#koakuma-switch {
		border: 0;
		padding: 3px 20px;
		border-radius: 3px;
		font-size: 16px;
	}
	#koakuma-switch:hover {
		box-shadow: 1px 1px gray;
	}
	#koakuma-switch:active {
		box-shadow: 1px 1px gray inset;
	}
	#koakuma-switch:focus {
		outline: 0;
	}
	#koakuma-switch.toSearch {
		background-color: lightgreen;
	}
	#koakuma-switch.toStop {
		background-color: lightpink;
	}
	#koakuma-switch.ended {
		background-color: lightgrey;
	}
	#koakuma-switch.ended:hover,
	#koakuma-switch.ended:hover {
		box-shadow: unset;
	}
	#こあくま {
		position: fixed;
		left: 22px;
		bottom: 10px;
		z-index: 1;
		background-color: aliceblue;
		border-radius: 10px;
		padding: 5px;
		font-size: 16px;
		text-align: center;
		width: 162px;
	}
	#こあくま > * {
		margin: 2px 0;
	}`);
}
