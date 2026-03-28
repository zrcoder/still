export namespace main {
	
	export class Creation {
	    id: number;
	    content: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Creation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.content = source["content"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class Fragment {
	    id: number;
	    title: string;
	    fullTitle: string;
	    description: string;
	    collectedAt: string;
	    positionX: number;
	    positionY: number;
	    angle: number;
	
	    static createFrom(source: any = {}) {
	        return new Fragment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.fullTitle = source["fullTitle"];
	        this.description = source["description"];
	        this.collectedAt = source["collectedAt"];
	        this.positionX = source["positionX"];
	        this.positionY = source["positionY"];
	        this.angle = source["angle"];
	    }
	}
	export class PaginatedResult {
	    items: any;
	    total: number;
	    page: number;
	    pageSize: number;
	    hasMore: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PaginatedResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.items = source["items"];
	        this.total = source["total"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.hasMore = source["hasMore"];
	    }
	}

}

