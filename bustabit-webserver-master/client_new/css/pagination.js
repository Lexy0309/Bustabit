function SetCookie(cName, cValue, cDay) { 
		var expire = new Date(); 
		expire.setDate(expire.getDate() + cDay); 
		cookies = cName + '=' + escape(cValue) + '; path=/ '; 
		if (typeof cDay != 'undefined') cookies += ';expires=' + expire.toGMTString() + ';'; 
		document.cookie = cookies; 
	}
function GetCookie(cName) { 
	cName = cName + '='; 
	var cookieData = document.cookie; 
	var start = cookieData.indexOf(cName); 
	var cValue = ''; 
	if (start != -1) { 
		start += cName.length; 
		var end = cookieData.indexOf(';', start);
		if (end == -1) end = cookieData.length; 
		cValue = cookieData.substring(start, end); 
	} 
	return unescape(cValue); 
} 
function GetPageValue(total, page, currentURL) {
	var pageIndex = Number(page);  
	var pageSize = Number('10'); 
	var totalCount = 1;
	totalCount = total;
	var pageCount = parseInt(totalCount / pageSize); 
	if (pageCount <= 0) pageCount = 0; 
	if (totalCount % pageSize > 0) pageCount++; 
	var maxPageTab = 5; 
	if (pageCount < maxPageTab) maxPageTab = pageCount; 
	if (pageIndex == 1){  
		SetCookie('pageTabBegin', 0); 
		SetCookie('pageTabEnd', maxPageTab); 
	} 
	var sLoopIndex = Number(GetCookie('pageTabBegin'));
	var eLoopIndex = Number(GetCookie('pageTabEnd'));
	if (pageIndex > eLoopIndex){
		SetCookie('pageTabBegin', (pageIndex) - maxPageTab); 
		SetCookie('pageTabEnd', (pageIndex)); 
		sLoopIndex = Number(GetCookie('pageTabBegin'));
		eLoopIndex = Number(GetCookie('pageTabEnd')); 
	} 
	if (pageIndex - 1 < sLoopIndex){ 
		SetCookie('pageTabBegin', (pageIndex - 1)); 
		SetCookie('pageTabEnd', (pageIndex - 1) + maxPageTab); 
		sLoopIndex = Number(GetCookie('pageTabBegin')); 
		eLoopIndex = Number(GetCookie('pageTabEnd')); 
	}
	
	AddPage(pageIndex, pageCount, sLoopIndex, eLoopIndex, currentURL);
}
function AddPage(pageIndex, pageCount, sLoopIndex, eLoopIndex, currentURL) { 
	var prevIndex = Number(pageIndex) - 1;
	if (prevIndex < 1) prevIndex = 1; 
	var nextIndex = Number(pageIndex) + 1; 
	if (nextIndex > pageCount) nextIndex = pageCount; 
	var html = ''; 
	html += '<div style="display:inline-block;">'; 
	html += '<div class="pageButton">'; 
	html += '<input id="idCharge" class="button secondary" style="width: 100%; height:30px; padding: 2px;" type="button" value="이전" onclick="Search('+ prevIndex + ');">';
	//html += '<a href="/' + currentURL + '?page=' + prevIndex + '">이전</a>'; 
	html += '</div>'; 
	for (var i = sLoopIndex; i < eLoopIndex; i++) {
		var temp; 
		if (i + 1 == Number(pageIndex)) {
			//temp = '<span class="selectPageColor">' + (i + 1) + '</span>'; 
			temp = (i + 1);
		}
		else { 
			temp = (i + 1); 
		}
		html += '<div class="pageButton">';
		if(temp == Number(pageIndex)){
			html += '<input id="idCharge" class="button secondary" style="background-color:#F3962F ;width: 100%; height:30px; padding: 2px;" type="button" value="' + temp + '" onclick="Search('+ temp + ');">';
		}
		else{
			html += '<input id="idCharge" class="button secondary" style="width: 100%; height:30px; padding: 2px;" type="button" value="' + temp + '" onclick="Search('+ temp + ');">';
		}
		html += '</div>';
		//html += '<a href="/' + currentURL + '?page=' + (i + 1) + '">' + temp + '</a>'; html += '</div>';
	} 
	html += '<div class="pageButton">'; 

	//html += '<a href="/' + currentURL + '?page=' + nextIndex + '">다음</a>'; 
	html += '<input id="idCharge" class="button secondary" style="width: 100%; height:30px; padding: 2px;" type="button" value="다음" onclick="Search(' + nextIndex + ');">';
	html += '</div>';
	html += '</div>';
	document.getElementById('idDivPage').innerHTML = html; 
}